from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import random
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
JWT_ALG = "HS256"
DEFAULT_DURATION_S = 300  # 5 minutes

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="KINGS OF PAINTBALL — KOP 3x3")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("kop")


# ---------- Utils ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_iso(s: str) -> datetime:
    return datetime.fromisoformat(s)


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str, email: str, role: str) -> str:
    return jwt.encode({
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }, JWT_SECRET, algorithm=JWT_ALG)


bearer = HTTPBearer(auto_error=False)


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)):
    if not creds:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(401, "User not found")
    return user


async def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user


def clean(doc):
    if not doc: return doc
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


# ---------- Models ----------
Level = Literal["INICIANTE", "INTERMEDIÁRIO", "PROFISSIONAL"]


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class PlayerRegisterIn(BaseModel):
    name: str
    level: Level
    photo: str
    nickname: Optional[str] = None
    whatsapp: Optional[str] = None
    notes: Optional[str] = None


class PlayerUpdateIn(BaseModel):
    name: Optional[str] = None
    level: Optional[Level] = None
    photo: Optional[str] = None
    nickname: Optional[str] = None
    whatsapp: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class TeamRenameIn(BaseModel):
    name: str


class GroupAssignIn(BaseModel):
    groups: dict


class DrawIn(BaseModel):
    num_teams: int = 10
    players_per_team: int = 3
    mode: Literal["NORMAL", "BALANCED"] = "BALANCED"


class EliminateIn(BaseModel):
    eliminated_id: str
    eliminator_id: str


class MvpIn(BaseModel):
    player_id: str


class TournamentUpdate(BaseModel):
    player_limit: Optional[int] = None
    num_teams: Optional[int] = None
    players_per_team: Optional[int] = None
    status: Optional[str] = None
    default_duration_s: Optional[int] = None


class DurationIn(BaseModel):
    duration_seconds: int


class SetWinnerIn(BaseModel):
    winner_team_id: Optional[str] = None  # null to force draw


DEFAULT_TEAMS = [
    "TEAM JAPAN", "TEAM YAGAMI", "TEAM IKARI", "TEAM OROCHI", "TEAM NESTS",
    "TEAM FATAL FURY", "TEAM ART OF FIGHTING", "TEAM PSYCHO SOLDIER",
    "TEAM WOMEN FIGHTERS", "TEAM KOF HEROES",
]


# ---------- Match helpers ----------
def default_match_fields(m):
    m.setdefault("duration_seconds", DEFAULT_DURATION_S)
    m.setdefault("eliminations", [])
    m.setdefault("started_at", None)
    m.setdefault("paused_at", None)
    m.setdefault("pause_accumulated_ms", 0)
    m.setdefault("ended_at", None)
    m.setdefault("is_draw", False)
    m.setdefault("locked", False)
    m.setdefault("perfect_a", False)
    m.setdefault("perfect_b", False)
    m.setdefault("points_a", 0)
    m.setdefault("points_b", 0)
    m.setdefault("elims_a", 0)
    m.setdefault("elims_b", 0)
    m.setdefault("eliminated_players_a", [])
    m.setdefault("eliminated_players_b", [])
    m.setdefault("winner_team_id", None)
    return m


def compute_elapsed_ms(m) -> int:
    if not m.get("started_at"):
        return 0
    started = parse_iso(m["started_at"])
    if m.get("ended_at"):
        end = parse_iso(m["ended_at"])
    elif m.get("paused_at"):
        end = parse_iso(m["paused_at"])
    else:
        end = datetime.now(timezone.utc)
    elapsed = int((end - started).total_seconds() * 1000) - int(m.get("pause_accumulated_ms", 0))
    return max(0, elapsed)


def compute_result(match, teams_by_id):
    ta = teams_by_id.get(match["team_a"], {"players": []})
    tb = teams_by_id.get(match["team_b"], {"players": []})
    a_ids = set(ta.get("players", []))
    b_ids = set(tb.get("players", []))
    elims_a = elims_b = 0
    eliminated_a: List[str] = []
    eliminated_b: List[str] = []
    for e in match.get("eliminations", []):
        killer = e["eliminator_id"]
        victim = e["eliminated_id"]
        if killer in a_ids: elims_a += 1
        elif killer in b_ids: elims_b += 1
        if victim in a_ids: eliminated_a.append(victim)
        elif victim in b_ids: eliminated_b.append(victim)
    is_draw = elims_a == elims_b
    winner_id = None
    if not is_draw:
        winner_id = match["team_a"] if elims_a > elims_b else match["team_b"]
    perfect_a = winner_id == match["team_a"] and elims_a == 3 and len(eliminated_a) == 0
    perfect_b = winner_id == match["team_b"] and elims_b == 3 and len(eliminated_b) == 0
    return {
        "elims_a": elims_a, "elims_b": elims_b,
        "points_a": elims_a, "points_b": elims_b,
        "eliminated_players_a": eliminated_a,
        "eliminated_players_b": eliminated_b,
        "winner_team_id": winner_id,
        "is_draw": is_draw,
        "perfect_a": perfect_a, "perfect_b": perfect_b,
    }


# ---------- Startup ----------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.players.create_index("id", unique=True)
    await db.teams.create_index("id", unique=True)
    await db.matches.create_index("id", unique=True)

    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": ADMIN_EMAIL,
            "password_hash": hash_pw(ADMIN_PASSWORD),
            "role": "admin", "name": "KOP Organizer", "created_at": now_iso(),
        })
    elif not verify_pw(ADMIN_PASSWORD, existing.get("password_hash", "")):
        await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"password_hash": hash_pw(ADMIN_PASSWORD)}})

    t = await db.tournament.find_one({"id": "main"})
    if not t:
        await db.tournament.insert_one({
            "id": "main", "name": "KINGS OF PAINTBALL — KOP 3x3",
            "num_teams": 10, "players_per_team": 3, "player_limit": 30,
            "status": "OPEN", "draw_done": False, "mvp_player_id": None,
            "default_duration_s": DEFAULT_DURATION_S, "created_at": now_iso(),
        })
        for i, name in enumerate(DEFAULT_TEAMS):
            await db.teams.insert_one({
                "id": str(uuid.uuid4()), "name": name, "order": i,
                "group": "A" if i < 5 else "B", "players": [], "created_at": now_iso(),
            })
    else:
        # ensure new field exists
        if "default_duration_s" not in t:
            await db.tournament.update_one({"id": "main"}, {"$set": {"default_duration_s": DEFAULT_DURATION_S}})


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ---------- Auth ----------
@api.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_pw(body.password, user["password_hash"]):
        raise HTTPException(401, "Credenciais inválidas")
    token = create_token(user["id"], user["email"], user["role"])
    return {"access_token": token, "token_type": "bearer", "user": clean(dict(user))}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return clean(dict(user))


# ---------- Players ----------
@api.post("/players/register")
async def register_player(body: PlayerRegisterIn):
    t = await db.tournament.find_one({"id": "main"})
    count = await db.players.count_documents({})
    if count >= (t.get("player_limit") or 30):
        raise HTTPException(400, "Limite de inscrições atingido")
    player = {
        "id": str(uuid.uuid4()), "name": body.name.strip(),
        "nickname": (body.nickname or "").strip() or None,
        "level": body.level, "photo": body.photo,
        "whatsapp": body.whatsapp, "notes": body.notes,
        "status": "CONFIRMADO", "team_id": None, "created_at": now_iso(),
    }
    await db.players.insert_one(player)
    return clean(player)


@api.get("/players")
async def list_players():
    docs = await db.players.find({}).sort("created_at", 1).to_list(1000)
    return [clean(d) for d in docs]


@api.get("/players/{pid}")
async def get_player(pid: str):
    d = await db.players.find_one({"id": pid})
    if not d: raise HTTPException(404, "Jogador não encontrado")
    return clean(d)


@api.patch("/players/{pid}")
async def update_player(pid: str, body: PlayerUpdateIn, _=Depends(require_admin)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        r = await db.players.update_one({"id": pid}, {"$set": updates})
        if r.matched_count == 0: raise HTTPException(404, "Jogador não encontrado")
    return await get_player(pid)


@api.delete("/players/{pid}")
async def delete_player(pid: str, _=Depends(require_admin)):
    await db.players.delete_one({"id": pid})
    await db.teams.update_many({}, {"$pull": {"players": pid}})
    return {"ok": True}


# ---------- Teams ----------
@api.get("/teams")
async def list_teams():
    docs = await db.teams.find({}).sort("order", 1).to_list(1000)
    return [clean(d) for d in docs]


@api.patch("/teams/{tid}")
async def rename_team(tid: str, body: TeamRenameIn, _=Depends(require_admin)):
    r = await db.teams.update_one({"id": tid}, {"$set": {"name": body.name.strip()}})
    if r.matched_count == 0: raise HTTPException(404, "Equipe não encontrada")
    return clean(await db.teams.find_one({"id": tid}))


@api.post("/teams/groups")
async def assign_groups(body: GroupAssignIn, _=Depends(require_admin)):
    for tid, grp in body.groups.items():
        await db.teams.update_one({"id": tid}, {"$set": {"group": grp}})
    return {"ok": True}


# ---------- Draw ----------
def balanced_split(players, num_teams, per_team):
    groups = {"PROFISSIONAL": [], "INTERMEDIÁRIO": [], "INICIANTE": []}
    for p in players:
        groups.get(p["level"], groups["INICIANTE"]).append(p)
    for k in groups: random.shuffle(groups[k])
    teams = [[] for _ in range(num_teams)]
    for lvl in ["PROFISSIONAL", "INTERMEDIÁRIO", "INICIANTE"]:
        for p in groups[lvl]:
            teams.sort(key=lambda t: len(t))
            for t in teams:
                if len(t) < per_team:
                    t.append(p); break
    return teams


def normal_split(players, num_teams, per_team):
    pool = players[:]; random.shuffle(pool)
    teams = [[] for _ in range(num_teams)]
    i = 0
    for p in pool:
        for _ in range(num_teams):
            if len(teams[i % num_teams]) < per_team:
                teams[i % num_teams].append(p); i += 1; break
            i += 1
    return teams


@api.post("/draw")
async def run_draw(body: DrawIn, _=Depends(require_admin)):
    players = await db.players.find({"status": "CONFIRMADO"}).to_list(1000)
    needed = body.num_teams * body.players_per_team
    if len(players) < needed:
        raise HTTPException(400, f"Necessário {needed} jogadores, temos {len(players)}")
    teams = await db.teams.find({}).sort("order", 1).to_list(1000)
    if len(teams) < body.num_teams:
        raise HTTPException(400, "Configure ao menos as equipes primeiro")
    selected = players[:needed]
    buckets = balanced_split(selected, body.num_teams, body.players_per_team) if body.mode == "BALANCED" else normal_split(selected, body.num_teams, body.players_per_team)
    await db.players.update_many({}, {"$set": {"team_id": None}})
    for t in teams[:body.num_teams]:
        await db.teams.update_one({"id": t["id"]}, {"$set": {"players": []}})
    for i, t in enumerate(teams[:body.num_teams]):
        pids = [p["id"] for p in buckets[i]]
        await db.teams.update_one({"id": t["id"]}, {"$set": {"players": pids}})
        for pid in pids:
            await db.players.update_one({"id": pid}, {"$set": {"team_id": t["id"]}})
    for i, t in enumerate(teams[:body.num_teams]):
        await db.teams.update_one({"id": t["id"]}, {"$set": {"group": "A" if i < body.num_teams // 2 else "B"}})
    await db.matches.delete_many({})
    await generate_group_matches()
    await db.tournament.update_one({"id": "main"}, {"$set": {
        "num_teams": body.num_teams, "players_per_team": body.players_per_team,
        "draw_done": True, "status": "GROUPS",
    }})
    return {"ok": True}


async def generate_group_matches():
    teams = await db.teams.find({}).sort("order", 1).to_list(1000)
    grp_a = [t for t in teams if t["group"] == "A" and t.get("players")]
    grp_b = [t for t in teams if t["group"] == "B" and t.get("players")]
    match_no = 1
    all_pairs = []
    tour = await db.tournament.find_one({"id": "main"})
    dur = tour.get("default_duration_s", DEFAULT_DURATION_S)
    for grp_teams, gname in [(grp_a, "A"), (grp_b, "B")]:
        pairs = []
        for i in range(len(grp_teams)):
            for j in range(i + 1, len(grp_teams)):
                pairs.append((grp_teams[i], grp_teams[j], gname))
        random.shuffle(pairs)
        ordered = []
        last = None
        remaining = pairs[:]
        while remaining:
            pick = 0
            for idx, p in enumerate(remaining):
                if last is None or (p[0]["id"] not in last and p[1]["id"] not in last):
                    pick = idx; break
            p = remaining.pop(pick)
            ordered.append(p); last = {p[0]["id"], p[1]["id"]}
        all_pairs.extend(ordered)
    for a, b, g in all_pairs:
        await db.matches.insert_one({
            "id": str(uuid.uuid4()), "number": match_no,
            "phase": "GROUP", "group": g,
            "team_a": a["id"], "team_b": b["id"],
            "status": "AGUARDANDO", "winner_team_id": None,
            "elims_a": 0, "elims_b": 0, "points_a": 0, "points_b": 0,
            "eliminated_players_a": [], "eliminated_players_b": [],
            "eliminations": [], "duration_seconds": dur,
            "started_at": None, "paused_at": None, "pause_accumulated_ms": 0,
            "ended_at": None, "is_draw": False, "locked": False,
            "perfect_a": False, "perfect_b": False,
            "created_at": now_iso(),
        })
        match_no += 1


# ---------- Tournament ----------
@api.get("/tournament")
async def get_tournament():
    t = await db.tournament.find_one({"id": "main"})
    return clean(t)


@api.patch("/tournament")
async def update_tournament(body: TournamentUpdate, _=Depends(require_admin)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.tournament.update_one({"id": "main"}, {"$set": updates})
    return await get_tournament()


@api.post("/tournament/reset")
async def reset_tournament(_=Depends(require_admin)):
    await db.matches.delete_many({})
    await db.teams.update_many({}, {"$set": {"players": []}})
    await db.players.update_many({}, {"$set": {"team_id": None}})
    await db.tournament.update_one({"id": "main"}, {"$set": {
        "draw_done": False, "status": "OPEN", "mvp_player_id": None,
    }})
    return {"ok": True}


# ---------- Matches ----------
@api.get("/matches")
async def list_matches():
    docs = await db.matches.find({}).sort("number", 1).to_list(1000)
    out = []
    for d in docs:
        d = default_match_fields(d)
        if d["status"] == "EM_ANDAMENTO" and compute_elapsed_ms(d) >= d["duration_seconds"] * 1000:
            await _finalize_match_internal(d["id"])
            d = default_match_fields(await db.matches.find_one({"id": d["id"]}))
        d["elapsed_ms"] = compute_elapsed_ms(d)
        d["remaining_ms"] = max(0, d["duration_seconds"] * 1000 - d["elapsed_ms"])
        out.append(clean(d))
    return out


async def _get_match_doc(mid):
    d = await db.matches.find_one({"id": mid})
    if not d: raise HTTPException(404, "Partida não encontrada")
    return default_match_fields(d)


@api.get("/matches/{mid}")
async def get_match(mid: str):
    d = await _get_match_doc(mid)
    if d["status"] == "EM_ANDAMENTO" and compute_elapsed_ms(d) >= d["duration_seconds"] * 1000:
        await _finalize_match_internal(mid)
        d = await _get_match_doc(mid)
    d["elapsed_ms"] = compute_elapsed_ms(d)
    d["remaining_ms"] = max(0, d["duration_seconds"] * 1000 - d["elapsed_ms"])
    return clean(d)


@api.post("/matches/{mid}/duration")
async def set_duration(mid: str, body: DurationIn, _=Depends(require_admin)):
    m = await _get_match_doc(mid)
    if m["status"] not in ("AGUARDANDO",):
        raise HTTPException(400, "Só é possível alterar a duração antes de iniciar a partida")
    await db.matches.update_one({"id": mid}, {"$set": {"duration_seconds": max(30, int(body.duration_seconds))}})
    return await get_match(mid)


@api.post("/matches/{mid}/start")
async def start_match(mid: str, _=Depends(require_admin)):
    m = await _get_match_doc(mid)
    if m.get("locked"):
        raise HTTPException(400, "Partida bloqueada")
    if m["status"] == "ENCERRADA":
        raise HTTPException(400, "Partida já encerrada")
    if m.get("started_at"):
        # already started; return current state
        return await get_match(mid)
    await db.matches.update_one({"id": mid}, {"$set": {
        "started_at": now_iso(), "status": "EM_ANDAMENTO",
        "paused_at": None, "pause_accumulated_ms": 0, "ended_at": None,
    }})
    return await get_match(mid)


@api.post("/matches/{mid}/pause")
async def pause_match(mid: str, _=Depends(require_admin)):
    m = await _get_match_doc(mid)
    if m["status"] != "EM_ANDAMENTO":
        raise HTTPException(400, "Só é possível pausar uma partida em andamento")
    await db.matches.update_one({"id": mid}, {"$set": {"paused_at": now_iso(), "status": "PAUSADA"}})
    return await get_match(mid)


@api.post("/matches/{mid}/resume")
async def resume_match(mid: str, _=Depends(require_admin)):
    m = await _get_match_doc(mid)
    if m["status"] != "PAUSADA":
        raise HTTPException(400, "Partida não está pausada")
    paused = parse_iso(m["paused_at"])
    delta_ms = int((datetime.now(timezone.utc) - paused).total_seconds() * 1000)
    await db.matches.update_one({"id": mid}, {
        "$set": {"paused_at": None, "status": "EM_ANDAMENTO"},
        "$inc": {"pause_accumulated_ms": delta_ms},
    })
    return await get_match(mid)


@api.post("/matches/{mid}/end")
async def end_match(mid: str, _=Depends(require_admin)):
    await _finalize_match_internal(mid)
    return await get_match(mid)


async def _finalize_match_internal(mid: str):
    m = await db.matches.find_one({"id": mid})
    if not m or m.get("status") == "ENCERRADA":
        return
    m = default_match_fields(m)
    teams = await db.teams.find({}).to_list(50)
    teams_by_id = {t["id"]: t for t in teams}
    r = compute_result(m, teams_by_id)
    update_set = {**r, "status": "ENCERRADA", "ended_at": now_iso()}
    ops = {"$set": update_set}
    if m.get("paused_at"):
        paused = parse_iso(m["paused_at"])
        delta_ms = int((datetime.now(timezone.utc) - paused).total_seconds() * 1000)
        update_set["paused_at"] = None
        ops["$inc"] = {"pause_accumulated_ms": delta_ms}
    await db.matches.update_one({"id": mid}, ops)
    await maybe_advance_playoffs()


@api.post("/matches/{mid}/reopen")
async def reopen_match(mid: str, _=Depends(require_admin)):
    """Admin correction: reopen a finished match."""
    m = await _get_match_doc(mid)
    if m.get("locked"):
        raise HTTPException(400, "Partida bloqueada")
    await db.matches.update_one({"id": mid}, {"$set": {
        "status": "PAUSADA" if m.get("started_at") else "AGUARDANDO",
        "ended_at": None,
    }})
    return await get_match(mid)


@api.post("/matches/{mid}/lock")
async def toggle_lock(mid: str, _=Depends(require_admin)):
    m = await _get_match_doc(mid)
    await db.matches.update_one({"id": mid}, {"$set": {"locked": not m.get("locked", False)}})
    return await get_match(mid)


@api.post("/matches/{mid}/set-winner")
async def set_winner(mid: str, body: SetWinnerIn, _=Depends(require_admin)):
    """Manual override — used for playoff draws where a winner must be chosen."""
    m = await _get_match_doc(mid)
    if body.winner_team_id and body.winner_team_id not in (m["team_a"], m["team_b"]):
        raise HTTPException(400, "Vencedor inválido")
    is_draw = body.winner_team_id is None
    await db.matches.update_one({"id": mid}, {"$set": {
        "winner_team_id": body.winner_team_id, "is_draw": is_draw,
    }})
    await maybe_advance_playoffs()
    return await get_match(mid)


# ---------- Eliminations ----------
@api.post("/matches/{mid}/eliminate")
async def add_elimination(mid: str, body: EliminateIn, _=Depends(require_admin)):
    m = await _get_match_doc(mid)
    if m.get("locked"):
        raise HTTPException(400, "Partida bloqueada")
    if m["status"] not in ("EM_ANDAMENTO",):
        raise HTTPException(400, "A partida precisa estar em andamento")
    ta = await db.teams.find_one({"id": m["team_a"]})
    tb = await db.teams.find_one({"id": m["team_b"]})
    a_ids = set(ta["players"]); b_ids = set(tb["players"])
    all_ids = a_ids | b_ids
    if body.eliminated_id == body.eliminator_id:
        raise HTTPException(400, "Um jogador não pode se auto-eliminar")
    if body.eliminated_id not in all_ids:
        raise HTTPException(400, "Jogador eliminado não pertence à partida")
    if body.eliminator_id not in all_ids:
        raise HTTPException(400, "Jogador eliminador não pertence à partida")
    same_a = body.eliminated_id in a_ids and body.eliminator_id in a_ids
    same_b = body.eliminated_id in b_ids and body.eliminator_id in b_ids
    if same_a or same_b:
        raise HTTPException(400, "Não é permitido eliminar um companheiro de equipe")
    already_eliminated = {e["eliminated_id"] for e in m.get("eliminations", [])}
    if body.eliminated_id in already_eliminated:
        raise HTTPException(400, "Jogador já foi eliminado")
    if body.eliminator_id in already_eliminated:
        raise HTTPException(400, "O jogador não pode eliminar depois de ter sido eliminado")
    entry = {
        "eliminated_id": body.eliminated_id,
        "eliminator_id": body.eliminator_id,
        "at_ms": compute_elapsed_ms(m), "at": now_iso(),
    }
    await db.matches.update_one({"id": mid}, {"$push": {"eliminations": entry}})
    # live update of aggregates (so /live is accurate mid-game)
    m = await _get_match_doc(mid)
    teams_by_id = {ta["id"]: ta, tb["id"]: tb}
    r = compute_result(m, teams_by_id)
    await db.matches.update_one({"id": mid}, {"$set": {
        "elims_a": r["elims_a"], "elims_b": r["elims_b"],
        "points_a": r["points_a"], "points_b": r["points_b"],
        "eliminated_players_a": r["eliminated_players_a"],
        "eliminated_players_b": r["eliminated_players_b"],
    }})
    # Auto-end when a full 3-0 wipe happens
    all_a_out = len(r["eliminated_players_a"]) >= len(ta["players"])
    all_b_out = len(r["eliminated_players_b"]) >= len(tb["players"])
    if all_a_out or all_b_out:
        await _finalize_match_internal(mid)
    return await get_match(mid)


@api.delete("/matches/{mid}/eliminate/last")
async def undo_last_elim(mid: str, _=Depends(require_admin)):
    m = await _get_match_doc(mid)
    if m.get("locked"):
        raise HTTPException(400, "Partida bloqueada")
    if not m.get("eliminations"):
        raise HTTPException(400, "Sem eliminações para desfazer")
    await db.matches.update_one({"id": mid}, {"$pop": {"eliminations": 1}})
    # If finished, reopen and recompute
    m = await _get_match_doc(mid)
    ta = await db.teams.find_one({"id": m["team_a"]})
    tb = await db.teams.find_one({"id": m["team_b"]})
    r = compute_result(m, {ta["id"]: ta, tb["id"]: tb})
    update = {
        "elims_a": r["elims_a"], "elims_b": r["elims_b"],
        "points_a": r["points_a"], "points_b": r["points_b"],
        "eliminated_players_a": r["eliminated_players_a"],
        "eliminated_players_b": r["eliminated_players_b"],
    }
    await db.matches.update_one({"id": mid}, {"$set": update})
    return await get_match(mid)


# ---------- Standings ----------
@api.get("/standings")
async def standings():
    teams = await db.teams.find({}).sort("order", 1).to_list(1000)
    matches = await db.matches.find({"phase": "GROUP", "status": "ENCERRADA"}).to_list(1000)

    def blank(t):
        return {
            "team_id": t["id"], "team_name": t["name"], "group": t["group"],
            "played": 0, "wins": 0, "draws": 0, "losses": 0,
            "elims_for": 0, "elims_against": 0, "diff": 0, "points": 0,
        }

    stats = {t["id"]: blank(t) for t in teams}
    for m in matches:
        m = default_match_fields(m)
        a, b = m["team_a"], m["team_b"]
        if a not in stats or b not in stats: continue
        stats[a]["played"] += 1; stats[b]["played"] += 1
        stats[a]["elims_for"] += m["elims_a"]; stats[a]["elims_against"] += m["elims_b"]
        stats[b]["elims_for"] += m["elims_b"]; stats[b]["elims_against"] += m["elims_a"]
        stats[a]["points"] += m["points_a"]; stats[b]["points"] += m["points_b"]
        if m.get("is_draw"):
            stats[a]["draws"] += 1; stats[b]["draws"] += 1
        elif m["winner_team_id"] == a:
            stats[a]["wins"] += 1; stats[b]["losses"] += 1
        elif m["winner_team_id"] == b:
            stats[b]["wins"] += 1; stats[a]["losses"] += 1
    for s in stats.values():
        s["diff"] = s["elims_for"] - s["elims_against"]

    def sort_key(s):
        return (-s["points"], -s["wins"], -s["draws"], -s["diff"], -s["elims_for"])

    grp_a = sorted([s for s in stats.values() if s["group"] == "A"], key=sort_key)
    grp_b = sorted([s for s in stats.values() if s["group"] == "B"], key=sort_key)
    return {"A": grp_a, "B": grp_b}


# ---------- Playoffs ----------
async def maybe_advance_playoffs():
    total_group = await db.matches.count_documents({"phase": "GROUP"})
    done_group = await db.matches.count_documents({"phase": "GROUP", "status": "ENCERRADA"})
    if total_group == 0 or done_group < total_group:
        return
    existing_semi = await db.matches.count_documents({"phase": "SEMI"})
    if existing_semi == 0:
        s = await standings()
        if len(s["A"]) < 2 or len(s["B"]) < 2: return
        a1, a2 = s["A"][0], s["A"][1]; b1, b2 = s["B"][0], s["B"][1]
        next_num = (await db.matches.count_documents({})) + 1
        semis = [(a1["team_id"], b2["team_id"]), (b1["team_id"], a2["team_id"])]
        tour = await db.tournament.find_one({"id": "main"})
        dur = tour.get("default_duration_s", DEFAULT_DURATION_S)
        for i, (ta, tb) in enumerate(semis):
            await db.matches.insert_one({
                "id": str(uuid.uuid4()), "number": next_num + i,
                "phase": "SEMI", "group": None,
                "team_a": ta, "team_b": tb, "status": "AGUARDANDO",
                "winner_team_id": None,
                "elims_a": 0, "elims_b": 0, "points_a": 0, "points_b": 0,
                "eliminated_players_a": [], "eliminated_players_b": [],
                "eliminations": [], "duration_seconds": dur,
                "started_at": None, "paused_at": None, "pause_accumulated_ms": 0,
                "ended_at": None, "is_draw": False, "locked": False,
                "perfect_a": False, "perfect_b": False,
                "created_at": now_iso(),
            })
        await db.tournament.update_one({"id": "main"}, {"$set": {"status": "PLAYOFFS"}})
        return

    total_semi = await db.matches.count_documents({"phase": "SEMI"})
    done_semi = await db.matches.count_documents({"phase": "SEMI", "status": "ENCERRADA"})
    existing_final = await db.matches.count_documents({"phase": "FINAL"})
    if done_semi == total_semi and total_semi == 2 and existing_final == 0:
        semis = await db.matches.find({"phase": "SEMI"}).sort("number", 1).to_list(10)
        # Require both semis to have a resolved winner (admin may need to set-winner if draw)
        if not all(s.get("winner_team_id") for s in semis):
            return
        s1, s2 = semis[0], semis[1]
        loser1 = s1["team_b"] if s1["winner_team_id"] == s1["team_a"] else s1["team_a"]
        loser2 = s2["team_b"] if s2["winner_team_id"] == s2["team_a"] else s2["team_a"]
        next_num = (await db.matches.count_documents({})) + 1
        tour = await db.tournament.find_one({"id": "main"})
        dur = tour.get("default_duration_s", DEFAULT_DURATION_S)
        base = {
            "elims_a": 0, "elims_b": 0, "points_a": 0, "points_b": 0,
            "eliminated_players_a": [], "eliminated_players_b": [],
            "eliminations": [], "duration_seconds": dur,
            "started_at": None, "paused_at": None, "pause_accumulated_ms": 0,
            "ended_at": None, "is_draw": False, "locked": False,
            "perfect_a": False, "perfect_b": False, "winner_team_id": None,
            "status": "AGUARDANDO", "created_at": now_iso(), "group": None,
        }
        await db.matches.insert_one({
            "id": str(uuid.uuid4()), "number": next_num, "phase": "THIRD",
            "team_a": loser1, "team_b": loser2, **base,
        })
        await db.matches.insert_one({
            "id": str(uuid.uuid4()), "number": next_num + 1, "phase": "FINAL",
            "team_a": s1["winner_team_id"], "team_b": s2["winner_team_id"], **base,
        })

    final = await db.matches.find_one({"phase": "FINAL"})
    if final and final["status"] == "ENCERRADA" and final.get("winner_team_id"):
        await db.tournament.update_one({"id": "main"}, {"$set": {"status": "FINISHED"}})


@api.get("/playoffs")
async def get_playoffs():
    docs = await db.matches.find({"phase": {"$in": ["SEMI", "FINAL", "THIRD"]}}).sort("number", 1).to_list(50)
    return [clean(default_match_fields(d)) for d in docs]


@api.get("/champion")
async def champion():
    final = await db.matches.find_one({"phase": "FINAL", "status": "ENCERRADA"})
    third = await db.matches.find_one({"phase": "THIRD", "status": "ENCERRADA"})
    result = {"first": None, "second": None, "third": None}
    if final and final.get("winner_team_id"):
        winner = final["winner_team_id"]
        loser = final["team_b"] if winner == final["team_a"] else final["team_a"]
        result["first"] = winner; result["second"] = loser
    if third and third.get("winner_team_id"):
        result["third"] = third["winner_team_id"]
    t = await db.tournament.find_one({"id": "main"})
    result["mvp_player_id"] = t.get("mvp_player_id")
    return result


@api.post("/champion/mvp")
async def set_mvp(body: MvpIn, _=Depends(require_admin)):
    await db.tournament.update_one({"id": "main"}, {"$set": {"mvp_player_id": body.player_id}})
    return {"ok": True}


# ---------- Stats ----------
@api.get("/stats/players")
async def player_stats():
    players = await db.players.find({}).to_list(1000)
    teams = await db.teams.find({}).to_list(50)
    team_by_id = {t["id"]: t for t in teams}
    matches = await db.matches.find({"status": "ENCERRADA"}).to_list(1000)

    stats = {}
    for p in players:
        stats[p["id"]] = {
            "player_id": p["id"], "name": p["name"], "nickname": p.get("nickname"),
            "photo": p.get("photo"), "level": p["level"],
            "team_id": p.get("team_id"),
            "team_name": team_by_id.get(p.get("team_id") or "", {}).get("name"),
            "matches": 0, "team_wins": 0, "team_draws": 0, "team_losses": 0,
            "eliminations": 0, "times_eliminated": 0, "diff": 0, "perfects": 0,
        }

    for m in matches:
        m = default_match_fields(m)
        team_a = team_by_id.get(m["team_a"], {})
        team_b = team_by_id.get(m["team_b"], {})
        team_a_players = team_a.get("players", []); team_b_players = team_b.get("players", [])
        for pid in team_a_players:
            if pid in stats:
                stats[pid]["matches"] += 1
                if m.get("is_draw"): stats[pid]["team_draws"] += 1
                elif m["winner_team_id"] == m["team_a"]:
                    stats[pid]["team_wins"] += 1
                    if m.get("perfect_a"): stats[pid]["perfects"] += 1
                else: stats[pid]["team_losses"] += 1
        for pid in team_b_players:
            if pid in stats:
                stats[pid]["matches"] += 1
                if m.get("is_draw"): stats[pid]["team_draws"] += 1
                elif m["winner_team_id"] == m["team_b"]:
                    stats[pid]["team_wins"] += 1
                    if m.get("perfect_b"): stats[pid]["perfects"] += 1
                else: stats[pid]["team_losses"] += 1
        for e in m.get("eliminations", []):
            if e["eliminator_id"] in stats:
                stats[e["eliminator_id"]]["eliminations"] += 1
            if e["eliminated_id"] in stats:
                stats[e["eliminated_id"]]["times_eliminated"] += 1

    for s in stats.values():
        s["diff"] = s["eliminations"] - s["times_eliminated"]
    return sorted(stats.values(), key=lambda s: (-s["eliminations"], s["times_eliminated"]))


@api.get("/stats/teams")
async def team_stats():
    teams = await db.teams.find({}).sort("order", 1).to_list(50)
    matches = await db.matches.find({"status": "ENCERRADA"}).to_list(1000)
    out = []
    for t in teams:
        played = wins = losses = draws = ef = ea = pts = perfects = 0
        streak = best = 0
        rel = sorted([m for m in matches if m["team_a"] == t["id"] or m["team_b"] == t["id"]],
                     key=lambda x: x["number"])
        for m in rel:
            m = default_match_fields(m)
            played += 1
            is_a = m["team_a"] == t["id"]
            if is_a:
                ef += m["elims_a"]; ea += m["elims_b"]; pts += m["points_a"]
            else:
                ef += m["elims_b"]; ea += m["elims_a"]; pts += m["points_b"]
            if m.get("is_draw"):
                draws += 1; streak = 0
            elif m["winner_team_id"] == t["id"]:
                wins += 1; streak += 1; best = max(best, streak)
                if (is_a and m.get("perfect_a")) or (not is_a and m.get("perfect_b")):
                    perfects += 1
            else:
                losses += 1; streak = 0
        out.append({
            "team_id": t["id"], "team_name": t["name"], "group": t["group"],
            "played": played, "wins": wins, "draws": draws, "losses": losses,
            "elims_for": ef, "elims_against": ea, "diff": ef - ea,
            "points": pts, "best_streak": best, "perfects": perfects,
        })
    return out


# ---------- Health ----------
@api.get("/")
async def root():
    return {"app": "KOP 3x3", "status": "running"}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"], allow_headers=["*"],
)

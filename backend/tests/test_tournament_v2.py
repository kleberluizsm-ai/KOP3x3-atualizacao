"""KOP 3x3 v2 backend integration tests: eliminations, timer, draws, playoffs."""
import os
import time
import base64
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE:
    # load from frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip()
                break
BASE = BASE.rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "nevernub@gmail.com"
ADMIN_PASS = "KopAdmin2026!"

PHOTO = "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\x00" * 40).decode()


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def public():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- 1. Reset & tournament state ----------
def test_01_reset_and_tournament(admin):
    # wipe old players for clean slate
    players = requests.get(f"{API}/players").json()
    for p in players:
        admin.delete(f"{API}/players/{p['id']}")
    r = admin.post(f"{API}/tournament/reset")
    assert r.status_code == 200
    t = requests.get(f"{API}/tournament").json()
    assert t["status"] == "OPEN"
    assert t["draw_done"] is False
    assert t["default_duration_s"] == 300


# ---------- 2. Register 30 players ----------
def test_02_register_30_players(public):
    levels = ["PROFISSIONAL"] * 10 + ["INTERMEDIÁRIO"] * 10 + ["INICIANTE"] * 10
    for i, lvl in enumerate(levels):
        r = public.post(f"{API}/players/register", json={
            "name": f"TEST_Player{i:02d}", "level": lvl, "photo": PHOTO,
        })
        assert r.status_code == 200, r.text
    players = requests.get(f"{API}/players").json()
    assert len(players) == 30


# ---------- 3. Draw ----------
def test_03_draw(admin):
    r = admin.post(f"{API}/draw", json={"num_teams": 10, "players_per_team": 3, "mode": "BALANCED"})
    assert r.status_code == 200, r.text
    matches = requests.get(f"{API}/matches").json()
    group_matches = [m for m in matches if m["phase"] == "GROUP"]
    assert len(group_matches) == 20
    for m in group_matches:
        assert m["duration_seconds"] == 300
        assert m["status"] == "AGUARDANDO"
        assert m["eliminations"] == []


# ---------- 4. Match doc fields ----------
def test_04_match_fields():
    matches = requests.get(f"{API}/matches").json()
    m = matches[0]
    r = requests.get(f"{API}/matches/{m['id']}").json()
    assert r["duration_seconds"] == 300
    assert r["elapsed_ms"] == 0
    assert r["remaining_ms"] == 300000
    assert r["started_at"] is None
    assert r["paused_at"] is None
    assert r["pause_accumulated_ms"] == 0


# ---------- Helpers ----------
def get_match(mid):
    return requests.get(f"{API}/matches/{mid}").json()


def get_group_match(idx=0):
    return [m for m in requests.get(f"{API}/matches").json() if m["phase"] == "GROUP"][idx]


def get_team_players(tid):
    t = [x for x in requests.get(f"{API}/teams").json() if x["id"] == tid][0]
    return t["players"]


# ---------- 5. Elim while AGUARDANDO ----------
def test_05_elim_before_start(admin):
    m = get_group_match(0)
    a_players = get_team_players(m["team_a"])
    b_players = get_team_players(m["team_b"])
    r = admin.post(f"{API}/matches/{m['id']}/eliminate",
                   json={"eliminated_id": b_players[0], "eliminator_id": a_players[0]})
    assert r.status_code == 400
    assert "andamento" in r.json()["detail"].lower()


# ---------- 6. Start match + auth ----------
def test_06_start_requires_auth(admin, public):
    m = get_group_match(0)
    # unauth
    r = public.post(f"{API}/matches/{m['id']}/start")
    assert r.status_code in (401, 403)
    # auth
    r = admin.post(f"{API}/matches/{m['id']}/start")
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "EM_ANDAMENTO"
    assert d["started_at"] is not None


# ---------- 7. Elimination validations ----------
def test_07_eliminate_validations(admin):
    m = get_group_match(0)
    a = get_team_players(m["team_a"])
    b = get_team_players(m["team_b"])
    mid = m["id"]

    # (a) self-elim
    r = admin.post(f"{API}/matches/{mid}/eliminate",
                   json={"eliminated_id": a[0], "eliminator_id": a[0]})
    assert r.status_code == 400 and "auto" in r.json()["detail"].lower()

    # (b) player not in match — use a player from match 2 (different teams)
    m2 = get_group_match(2)
    other = [p for p in get_team_players(m2["team_a"]) if p not in a and p not in b][0]
    r = admin.post(f"{API}/matches/{mid}/eliminate",
                   json={"eliminated_id": other, "eliminator_id": a[0]})
    assert r.status_code == 400

    # (c) same-team elim
    r = admin.post(f"{API}/matches/{mid}/eliminate",
                   json={"eliminated_id": a[1], "eliminator_id": a[0]})
    assert r.status_code == 400 and "companheiro" in r.json()["detail"].lower()

    # (d) valid: A kills B[0]
    r = admin.post(f"{API}/matches/{mid}/eliminate",
                   json={"eliminated_id": b[0], "eliminator_id": a[0]})
    assert r.status_code == 200
    d = r.json()
    assert d["elims_a"] == 1

    # (e) double kill same victim
    r = admin.post(f"{API}/matches/{mid}/eliminate",
                   json={"eliminated_id": b[0], "eliminator_id": a[1]})
    assert r.status_code == 400 and "já foi eliminado" in r.json()["detail"].lower()

    # (f) killer gets eliminated then tries to kill
    # B[1] kills A[0]  (a[0] becomes eliminated)
    r = admin.post(f"{API}/matches/{mid}/eliminate",
                   json={"eliminated_id": a[0], "eliminator_id": b[1]})
    assert r.status_code == 200
    # Now a[0] (already eliminated) tries to kill b[2]
    r = admin.post(f"{API}/matches/{mid}/eliminate",
                   json={"eliminated_id": b[2], "eliminator_id": a[0]})
    assert r.status_code == 400 and "depois de ter sido eliminado" in r.json()["detail"].lower()


# ---------- 8. Points formula (no 3-pt bonus) ----------
def test_08_points_formula(admin):
    # In match 0: currently elims_a=1, elims_b=1
    m = get_match(get_group_match(0)["id"])
    a = get_team_players(m["team_a"])
    b = get_team_players(m["team_b"])
    # Have a[1] kill b[1] → elims_a=2, elims_b=1
    r = admin.post(f"{API}/matches/{m['id']}/eliminate",
                   json={"eliminated_id": b[1], "eliminator_id": a[1]})
    assert r.status_code == 200
    d = r.json()
    assert d["elims_a"] == 2 and d["elims_b"] == 1
    assert d["points_a"] == 2 and d["points_b"] == 1  # no bonus


# ---------- 9. Auto-end on wipe (perfect) — use match 1 ----------
def test_09_auto_end_wipe_perfect(admin):
    m = get_group_match(1)
    admin.post(f"{API}/matches/{m['id']}/start")
    a = get_team_players(m["team_a"])
    b = get_team_players(m["team_b"])
    for i in range(3):
        r = admin.post(f"{API}/matches/{m['id']}/eliminate",
                       json={"eliminated_id": b[i], "eliminator_id": a[i % 3]})
        assert r.status_code == 200
    d = get_match(m["id"])
    assert d["status"] == "ENCERRADA"
    assert d["winner_team_id"] == m["team_a"]
    assert d["perfect_a"] is True
    assert d["points_a"] == 3 and d["points_b"] == 0


# ---------- 10. Manual end with 2-1 (finish match 0) ----------
def test_10_manual_end(admin):
    m = get_group_match(0)
    r = admin.post(f"{API}/matches/{m['id']}/end")
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "ENCERRADA"
    assert d["is_draw"] is False  # 2-1
    assert d["points_a"] == 2 and d["points_b"] == 1


# ---------- 11. Draw manual end 0-0 (match 2) ----------
def test_11_draw_manual_end(admin):
    m = get_group_match(2)
    admin.post(f"{API}/matches/{m['id']}/start")
    r = admin.post(f"{API}/matches/{m['id']}/end")
    assert r.status_code == 200
    d = r.json()
    assert d["is_draw"] is True
    assert d["winner_team_id"] is None
    assert d["perfect_a"] is False and d["perfect_b"] is False


# ---------- 12. Pause / Resume ----------
def test_12_pause_resume(admin):
    m = get_group_match(3)
    admin.post(f"{API}/matches/{m['id']}/start")
    time.sleep(1)
    r = admin.post(f"{API}/matches/{m['id']}/pause")
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "PAUSADA"
    assert d["paused_at"] is not None
    rem1 = d["remaining_ms"]
    time.sleep(1.5)
    d2 = get_match(m["id"])
    # remaining should be stable during pause (allow tiny drift)
    assert abs(d2["remaining_ms"] - rem1) < 200, (rem1, d2["remaining_ms"])
    r = admin.post(f"{API}/matches/{m['id']}/resume")
    assert r.status_code == 200
    d3 = r.json()
    assert d3["status"] == "EM_ANDAMENTO"
    assert d3["pause_accumulated_ms"] >= 1000


# ---------- 13. Duration change + timer expiry auto-end ----------
def test_13_timer_expiry_autoend(admin):
    m = get_group_match(4)
    # set duration to 3s before start
    r = admin.post(f"{API}/matches/{m['id']}/duration", json={"duration_seconds": 3})
    # min is 30 in server code! max(30, 3) → 30. Ugh.
    d = r.json()
    # Check what happened
    assert r.status_code == 200
    duration = d["duration_seconds"]
    admin.post(f"{API}/matches/{m['id']}/start")
    # Cannot change after start
    r2 = admin.post(f"{API}/matches/{m['id']}/duration", json={"duration_seconds": 60})
    assert r2.status_code == 400
    time.sleep(duration + 1.5)
    d = get_match(m["id"])
    assert d["status"] == "ENCERRADA"
    assert d["is_draw"] is True


# ---------- 14. Non-perfect 3-1 ----------
def test_14_non_perfect(admin):
    m = get_group_match(5)
    admin.post(f"{API}/matches/{m['id']}/start")
    a = get_team_players(m["team_a"])
    b = get_team_players(m["team_b"])
    # B kills A[0] first
    admin.post(f"{API}/matches/{m['id']}/eliminate",
               json={"eliminated_id": a[0], "eliminator_id": b[0]})
    # A wipes B
    for i in range(3):
        admin.post(f"{API}/matches/{m['id']}/eliminate",
                   json={"eliminated_id": b[i], "eliminator_id": a[(i + 1) % 3] if i == 0 else a[1]})
    d = get_match(m["id"])
    assert d["status"] == "ENCERRADA"
    assert d["winner_team_id"] == m["team_a"]
    assert d["perfect_a"] is False
    assert d["elims_a"] == 3 and d["elims_b"] == 1
    assert d["points_a"] == 3 and d["points_b"] == 1


# ---------- 15. Draw 1-1 & 2-2 ----------
def test_15_draw_variants(admin):
    # 1-1 on match 6
    m = get_group_match(6)
    admin.post(f"{API}/matches/{m['id']}/start")
    a = get_team_players(m["team_a"])
    b = get_team_players(m["team_b"])
    admin.post(f"{API}/matches/{m['id']}/eliminate", json={"eliminated_id": b[0], "eliminator_id": a[0]})
    admin.post(f"{API}/matches/{m['id']}/eliminate", json={"eliminated_id": a[1], "eliminator_id": b[1]})
    d = admin.post(f"{API}/matches/{m['id']}/end").json()
    assert d["is_draw"] and d["winner_team_id"] is None
    assert d["points_a"] == 1 and d["points_b"] == 1

    # 2-2 on match 7
    m = get_group_match(7)
    admin.post(f"{API}/matches/{m['id']}/start")
    a = get_team_players(m["team_a"])
    b = get_team_players(m["team_b"])
    admin.post(f"{API}/matches/{m['id']}/eliminate", json={"eliminated_id": b[0], "eliminator_id": a[0]})
    admin.post(f"{API}/matches/{m['id']}/eliminate", json={"eliminated_id": b[1], "eliminator_id": a[1]})
    admin.post(f"{API}/matches/{m['id']}/eliminate", json={"eliminated_id": a[2], "eliminator_id": b[2]})
    # a[0] already killed — try a[0] again as victim? no need; use a[1] as victim from b[?]
    # b[2] already killed a[2]. Need another elim by B — use... b[2] alive still, can also kill a[0] but a[0] already alive (elimin not eliminated yet on B side)
    # Wait, a[0] is a killer not eliminated. b[2] kills a[0]:
    admin.post(f"{API}/matches/{m['id']}/eliminate", json={"eliminated_id": a[0], "eliminator_id": b[2]})
    d = admin.post(f"{API}/matches/{m['id']}/end").json()
    assert d["is_draw"], f"expected draw, got {d}"
    assert d["points_a"] == 2 and d["points_b"] == 2


# ---------- 16. Undo last ----------
def test_16_undo_last(admin):
    m = get_group_match(8)
    admin.post(f"{API}/matches/{m['id']}/start")
    a = get_team_players(m["team_a"])
    b = get_team_players(m["team_b"])
    admin.post(f"{API}/matches/{m['id']}/eliminate", json={"eliminated_id": b[0], "eliminator_id": a[0]})
    admin.post(f"{API}/matches/{m['id']}/eliminate", json={"eliminated_id": b[1], "eliminator_id": a[1]})
    d = get_match(m["id"])
    assert d["elims_a"] == 2
    r = admin.delete(f"{API}/matches/{m['id']}/eliminate/last")
    assert r.status_code == 200
    d = r.json()
    assert d["elims_a"] == 1
    assert len(d["eliminations"]) == 1


# ---------- 17. Lock ----------
def test_17_lock(admin):
    m = get_group_match(9)
    admin.post(f"{API}/matches/{m['id']}/start")
    r = admin.post(f"{API}/matches/{m['id']}/lock")
    assert r.status_code == 200
    assert r.json()["locked"] is True
    a = get_team_players(m["team_a"])
    b = get_team_players(m["team_b"])
    r = admin.post(f"{API}/matches/{m['id']}/eliminate",
                   json={"eliminated_id": b[0], "eliminator_id": a[0]})
    assert r.status_code == 400 and "bloqueada" in r.json()["detail"].lower()
    r = admin.delete(f"{API}/matches/{m['id']}/eliminate/last")
    assert r.status_code == 400
    # unlock
    admin.post(f"{API}/matches/{m['id']}/lock")


# ---------- 18. Finish remaining group matches to enable playoffs ----------
def test_18_finish_all_group(admin):
    matches = [m for m in requests.get(f"{API}/matches").json()
               if m["phase"] == "GROUP" and m["status"] != "ENCERRADA"]
    for m in matches:
        if m["status"] == "AGUARDANDO":
            admin.post(f"{API}/matches/{m['id']}/start")
        # end as draw
        r = admin.post(f"{API}/matches/{m['id']}/end")
        assert r.status_code == 200
    left = [m for m in requests.get(f"{API}/matches").json()
            if m["phase"] == "GROUP" and m["status"] != "ENCERRADA"]
    assert left == []


# ---------- 19. Standings has draws column ----------
def test_19_standings(admin):
    s = requests.get(f"{API}/standings").json()
    # s is dict {A:[], B:[]} or list. Inspect:
    entries = s if isinstance(s, list) else (s.get("A", []) + s.get("B", []))
    assert entries
    for e in entries:
        assert "draws" in e
        assert "points" in e
        # points == elims_for
        assert e["points"] == e["elims_for"]


# ---------- 20. Playoff auto-gen + set-winner ----------
def test_20_playoffs(admin):
    po = requests.get(f"{API}/playoffs").json()
    semis = po if isinstance(po, list) else po.get("semis", [])
    if not semis:
        # try flattened structure
        semis = [m for m in requests.get(f"{API}/matches").json() if m["phase"] == "SEMI"]
    assert len(semis) == 2
    # End each semi as draw and set winner
    for sm in semis:
        admin.post(f"{API}/matches/{sm['id']}/start")
        admin.post(f"{API}/matches/{sm['id']}/end")  # 0-0 draw
        r = admin.post(f"{API}/matches/{sm['id']}/set-winner",
                       json={"winner_team_id": sm["team_a"]})
        assert r.status_code == 200
        assert r.json()["winner_team_id"] == sm["team_a"]
    # After both winners resolved, final + third should be created
    all_matches = requests.get(f"{API}/matches").json()
    finals = [m for m in all_matches if m["phase"] == "FINAL"]
    thirds = [m for m in all_matches if m["phase"] == "THIRD"]
    assert len(finals) == 1
    assert len(thirds) == 1


# ---------- 21. Player & team stats ----------
def test_21_stats():
    ps = requests.get(f"{API}/stats/players").json()
    assert len(ps) == 30
    # at least some elims recorded
    assert any(p["eliminations"] > 0 for p in ps)
    assert any(p["times_eliminated"] > 0 for p in ps)
    ts = requests.get(f"{API}/stats/teams").json()
    assert len(ts) == 10
    assert any("draws" in t for t in ts)
    assert any("perfects" in t for t in ts)


# ---------- 22. Auth enforcement matrix ----------
def test_22_auth_enforcement(public):
    matches = requests.get(f"{API}/matches").json()
    mid = matches[0]["id"]
    endpoints = [
        ("post", f"/matches/{mid}/start", None),
        ("post", f"/matches/{mid}/pause", None),
        ("post", f"/matches/{mid}/resume", None),
        ("post", f"/matches/{mid}/end", None),
        ("post", f"/matches/{mid}/duration", {"duration_seconds": 60}),
        ("post", f"/matches/{mid}/eliminate", {"eliminated_id": "x", "eliminator_id": "y"}),
        ("delete", f"/matches/{mid}/eliminate/last", None),
        ("post", f"/matches/{mid}/lock", None),
        ("post", f"/matches/{mid}/set-winner", {"winner_team_id": None}),
    ]
    for method, path, body in endpoints:
        r = getattr(public, method)(f"{API}{path}", json=body)
        assert r.status_code in (401, 403), f"{method} {path} → {r.status_code}"

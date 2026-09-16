import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { PlayerCard } from "../components/PlayerCard";
import { sfx } from "../sound";

function fmtTime(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
}

function HPBar({ alive, total, mirror = false, color = "cyan", teamName, roster = [], eliminatedIds = new Set() }) {
  const pct = total > 0 ? (alive / total) * 100 : 0;
  const [displayed, setDisplayed] = useState(pct);
  const [residual, setResidual] = useState(pct);
  const [damaging, setDamaging] = useState(false);
  const prevRef = useRef(pct);
  useEffect(() => {
    const prev = prevRef.current;
    if (pct < prev) {
      setDamaging(true); setDisplayed(pct);
      const start = Date.now(), from = prev, to = pct, dur = 900;
      const iv = setInterval(() => {
        const t = Math.min(1, (Date.now() - start) / dur);
        const e = 1 - Math.pow(1 - t, 3);
        setResidual(from + (to - from) * e);
        if (t >= 1) clearInterval(iv);
      }, 30);
      const ft = setTimeout(() => setDamaging(false), 300);
      return () => { clearInterval(iv); clearTimeout(ft); };
    } else if (pct > prev) { setDisplayed(pct); setResidual(pct); }
    prevRef.current = pct;
  }, [pct]);
  const healthy = pct >= 67, critical = pct > 0 && pct <= 34, dead = pct === 0;
  const fillGradient = healthy
    ? (color === "cyan" ? "linear-gradient(90deg,#22d3ee,#06b6d4,#00e5ff)" : "linear-gradient(90deg,#22c55e,#16a34a,#4ade80)")
    : critical ? "linear-gradient(90deg,#f59e0b,#ff6b00,#ffcc00)" : "linear-gradient(90deg,#374151,#1f2937)";
  const glow = healthy
    ? (color === "cyan" ? "0 0 20px rgba(0,229,255,0.55)" : "0 0 20px rgba(34,197,94,0.55)")
    : critical ? "0 0 22px rgba(255,107,0,0.7)" : "0 0 4px rgba(0,0,0,0.6)";
  return (
    <div className="w-full relative">
      <div className={`flex items-baseline justify-between gap-2 mb-1 ${mirror ? "flex-row-reverse" : ""}`}>
        <div className={`font-arcade uppercase tracking-widest text-sm sm:text-lg ${color === "cyan" ? "text-cyan-300" : "text-red-400"} truncate max-w-[70%]`}>{teamName}</div>
        <div data-testid={`hp-label-${mirror ? "a" : "b"}`} className={`font-mono-num text-[10px] sm:text-xs uppercase tracking-widest ${critical ? "text-yellow-300 animate-kop-pulse" : dead ? "text-red-500" : "text-slate-400"}`}>
          {alive}/{total} VIVOS · {Math.round(pct)}%
        </div>
      </div>
      <div className={`relative h-6 sm:h-8 border-2 ${dead ? "border-red-600" : critical ? "border-yellow-400" : color === "cyan" ? "border-cyan-500/70" : "border-green-500/70"} bg-black/90 overflow-hidden kop-chamfer`}
           style={{ transform: mirror ? "scaleX(-1)" : "none" }}>
        <div className="absolute inset-0 kop-diag-bg opacity-30" />
        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500 to-red-800"
             style={{ width: `${residual}%`, opacity: residual > displayed ? 0.85 : 0, transition: "opacity 200ms" }} />
        <div className={`absolute inset-y-0 left-0 ${damaging ? "animate-kop-flicker" : ""}`}
             style={{ width: `${displayed}%`, background: fillGradient, boxShadow: glow, transition: "width 250ms cubic-bezier(0.34,1.56,0.64,1)" }} />
        <div className="absolute inset-y-0 left-1/3 w-px bg-black/60" />
        <div className="absolute inset-y-0 left-2/3 w-px bg-black/60" />
        {damaging && <div className="absolute inset-0 bg-yellow-300/40 mix-blend-screen animate-kop-flicker" />}
      </div>
      <div className={`mt-2 flex flex-wrap gap-1.5 ${mirror ? "justify-end" : "justify-start"}`}>
        {roster.map(p => {
          const out = eliminatedIds.has(p.id);
          return (
            <div key={p.id} className={`inline-flex items-center gap-1 px-2 py-0.5 border kop-chamfer text-[10px] sm:text-xs font-display uppercase tracking-widest ${out ? "border-slate-800 text-slate-600 line-through" : color === "cyan" ? "border-cyan-500/50 text-cyan-200" : "border-green-500/50 text-green-200"}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${out ? "bg-slate-700" : "bg-green-400 animate-kop-pulse"}`} />
              <span className="truncate max-w-[110px]">{p.name}</span>
              <span className={`text-[9px] ${out ? "text-slate-700" : color === "cyan" ? "text-cyan-500" : "text-green-500"}`}>{out ? "[ELIMINADO]" : "[VIVO]"}</span>
            </div>
          );
        })}
      </div>
      {dead && (
        <div className={`absolute -top-3 sm:-top-4 ${mirror ? "right-0" : "left-0"} z-20 animate-kop-slam`}>
          <div className="font-arcade text-2xl sm:text-4xl text-red-500 uppercase tracking-widest px-3 py-1 border-2 border-red-500 bg-black/90 kop-glow-red" style={{ textShadow: "0 0 20px rgba(255,46,76,1)" }}>K.O.</div>
        </div>
      )}
    </div>
  );
}

function StandingsView({ teams }) {
  const [rows, setRows] = useState({ A: [], B: [] });
  useEffect(() => {
    const iv = setInterval(() => api.get("/standings").then(r => setRows(r.data)), 3000);
    api.get("/standings").then(r => setRows(r.data));
    return () => clearInterval(iv);
  }, []);
  const Row = ({ r, i, color }) => (
    <tr className={`border-t border-slate-800 ${i < 2 ? "bg-red-500/10" : ""}`}>
      <td className="p-3 font-mono-num text-2xl">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1 + "º"}</td>
      <td className="p-3 font-arcade uppercase text-white text-2xl truncate">{r.team_name}</td>
      <td className="p-3 text-right font-mono-num text-xl">{r.played}</td>
      <td className="p-3 text-right font-mono-num text-green-400 text-xl">{r.wins}</td>
      <td className="p-3 text-right font-mono-num text-cyan-300 text-xl">{r.draws}</td>
      <td className="p-3 text-right font-mono-num text-red-400 text-xl">{r.losses}</td>
      <td className={`p-3 text-right font-mono-num text-xl ${r.diff > 0 ? "text-green-400" : r.diff < 0 ? "text-red-400" : "text-slate-400"}`}>{r.diff > 0 ? "+" : ""}{r.diff}</td>
      <td className="p-3 text-right font-arcade text-yellow-400 text-3xl">{r.points}</td>
    </tr>
  );
  const Group = ({ items, name, color }) => (
    <div className="flex-1 min-w-0">
      <div className={`font-arcade text-3xl ${color} uppercase mb-2 tracking-widest`}>Grupo {name}</div>
      <table className="w-full border border-slate-800 kop-chamfer overflow-hidden">
        <thead className="bg-black/80 text-slate-500 uppercase text-xs">
          <tr><th className="p-2 text-left">POS</th><th className="p-2 text-left">Equipe</th><th className="p-2 text-right">J</th><th className="p-2 text-right">V</th><th className="p-2 text-right">E</th><th className="p-2 text-right">D</th><th className="p-2 text-right">SAL</th><th className="p-2 text-right">PTS</th></tr>
        </thead>
        <tbody>{items.map((r, i) => <Row key={r.team_id} r={r} i={i} color={color} />)}</tbody>
      </table>
    </div>
  );
  return (
    <div className="w-full max-w-7xl px-4 mt-6">
      <div className="text-center mb-6">
        <div className="font-arcade text-red-500 text-sm sm:text-lg tracking-[0.5em] uppercase animate-kop-flicker">KOP 3x3 — LIVE STANDINGS</div>
        <div className="font-arcade text-4xl sm:text-6xl text-white uppercase tracking-widest mt-1">CLASSIFICAÇÃO</div>
        <div className="font-display text-xs sm:text-sm text-cyan-300 uppercase tracking-widest">Pts = 3 vitória + 2 bônus wipe · Empate/Derrota = 0</div>
      </div>
      <div className="flex flex-col lg:flex-row gap-6"><Group items={rows.A} name="A" color="text-red-400" /><Group items={rows.B} name="B" color="text-cyan-300" /></div>
    </div>
  );
}

export default function Live() {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [liveState, setLiveState] = useState({ mode: "MATCH", match_id: null });
  const [tick, setTick] = useState(0);
  const [overlay, setOverlay] = useState(null);
  const lastElimsRef = useRef({}); const lastStatusRef = useRef({}); const lastCdRef = useRef({});

  const load = async () => {
    const [m, t, p, s] = await Promise.all([
      api.get("/matches"), api.get("/teams"), api.get("/players"), api.get("/live/state"),
    ]);
    setMatches(m.data); setTeams(t.data); setPlayers(p.data); setLiveState(s.data);
  };
  useEffect(() => { load(); const iv = setInterval(load, 1200); return () => clearInterval(iv); }, []);
  useEffect(() => { const iv = setInterval(() => setTick(t => t + 1), 250); return () => clearInterval(iv); }, []);

  const byId = Object.fromEntries(players.map(p => [p.id, p]));

  const featured = useMemo(() => {
    if (liveState?.match_id) return matches.find(m => m.id === liveState.match_id) || null;
    // Auto-fallback only when admin hasn't pinned anything
    return matches.find(m => m.status === "EM_ANDAMENTO")
      || matches.find(m => m.status === "PAUSADA")
      || matches.find(m => m.status === "AGUARDANDO")
      || [...matches].reverse().find(m => m.status === "ENCERRADA");
  }, [matches, liveState?.match_id]);

  const remainingMs = useMemo(() => {
    if (!featured) return 0;
    if (featured.status === "EM_ANDAMENTO" && featured.started_at) {
      const started = new Date(featured.started_at).getTime();
      const elapsed = Date.now() - started - (featured.pause_accumulated_ms || 0);
      return Math.max(0, featured.duration_seconds * 1000 - elapsed);
    }
    return featured.remaining_ms ?? (featured.duration_seconds || 300) * 1000;
  }, [featured, tick]);

  useEffect(() => {
    if (!featured) return;
    const key = featured.id;
    const cur = (featured.eliminations || []).length;
    const prev = lastElimsRef.current[key] || 0;
    if (cur > prev && featured.eliminations?.length) {
      const last = featured.eliminations[featured.eliminations.length - 1];
      const victim = byId[last.eliminated_id];
      if (victim) { sfx.elim(); setOverlay({ type: "ELIM", victim }); setTimeout(() => setOverlay(null), 2200); }
    }
    lastElimsRef.current[key] = cur;
    if (featured.status === "EM_ANDAMENTO") {
      const secs = Math.ceil(remainingMs / 1000);
      const cd = lastCdRef.current[key] || {};
      if (secs === 60 && !cd[60]) { cd[60] = true; sfx.timeWarn(); }
      if (secs === 30 && !cd[30]) { cd[30] = true; sfx.timeWarn(); }
      if (secs <= 10 && secs > 0 && !cd[secs]) { cd[secs] = true; sfx.countdown(); }
      lastCdRef.current[key] = cd;
    }
    const prevStatus = lastStatusRef.current[key];
    if (prevStatus && prevStatus !== featured.status) {
      if (featured.status === "EM_ANDAMENTO") { sfx.fight(); setOverlay({ type: "FIGHT" }); setTimeout(() => setOverlay(null), 1500); }
      else if (featured.status === "ENCERRADA") {
        if (featured.perfect_a || featured.perfect_b) { sfx.perfect(); setOverlay({ type: "PERFECT", match: featured }); setTimeout(() => setOverlay(null), 4000); }
        else if (featured.is_draw) { sfx.draw(); setOverlay({ type: "DRAW", match: featured }); setTimeout(() => setOverlay(null), 3000); }
        else { sfx.winner(); setOverlay({ type: "WINNER", match: featured }); setTimeout(() => setOverlay(null), 3500); }
      }
    }
    lastStatusRef.current[key] = featured.status;
  }, [featured?.eliminations?.length, featured?.status, remainingMs]);

  // STANDINGS view
  if (liveState?.mode === "STANDINGS") {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black">
        <div className="absolute inset-0 kop-grid-bg opacity-30" />
        <div className="scanlines absolute inset-0 opacity-50" />
        <Link to="/" className="absolute top-4 left-4 z-30 text-xs font-display text-slate-600 hover:text-white uppercase tracking-widest">← EXIT</Link>
        <div className="relative z-10 min-h-screen flex flex-col items-center py-6">
          <StandingsView teams={teams} />
        </div>
      </div>
    );
  }

  if (!featured) return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <div className="font-arcade text-6xl text-red-500 uppercase animate-kop-pulse">KOP 3x3</div>
        <div className="mt-4 text-slate-500 font-display uppercase tracking-widest">Aguardando o organizador carregar a próxima partida</div>
        <Link to="/" className="mt-6 inline-block text-xs text-slate-600 uppercase font-display">← sair do modo telão</Link>
      </div>
    </div>
  );

  const teamA = teams.find(t => t.id === featured.team_a);
  const teamB = teams.find(t => t.id === featured.team_b);
  const rosterA = (teamA?.players || []).map(pid => byId[pid]).filter(Boolean);
  const rosterB = (teamB?.players || []).map(pid => byId[pid]).filter(Boolean);
  const eliminatedIds = new Set((featured.eliminations || []).map(e => e.eliminated_id));
  const aliveA = rosterA.filter(p => !eliminatedIds.has(p.id)).length;
  const aliveB = rosterB.filter(p => !eliminatedIds.has(p.id)).length;
  const secs = Math.ceil(remainingMs / 1000);
  const showBigCountdown = featured.status === "EM_ANDAMENTO" && secs <= 10 && secs > 0;
  const finished = featured.status === "ENCERRADA";
  const winnerName = teams.find(t => t.id === featured.winner_team_id)?.name;

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      <div className="absolute inset-0 kop-grid-bg opacity-30" />
      <div className="scanlines absolute inset-0 opacity-50" />
      <Link to="/" className="absolute top-4 left-4 z-30 text-xs font-display text-slate-600 hover:text-white uppercase tracking-widest">← EXIT</Link>

      <div className="relative z-10 min-h-screen flex flex-col items-center p-4 sm:p-6">
        <div className="text-center">
          <div className="font-arcade text-red-500 text-sm sm:text-lg tracking-[0.5em] uppercase animate-kop-flicker">KINGS OF PAINTBALL — LIVE</div>
          <div className="font-arcade text-2xl sm:text-4xl text-white uppercase tracking-widest mt-1">MATCH {String(featured.number).padStart(2, "0")}</div>
          <div className="font-display text-xs sm:text-sm text-cyan-300 uppercase tracking-widest">
            {featured.phase === "GROUP" ? `Grupo ${featured.group}` : featured.phase}
            {" · "}
            <span className={finished ? (featured.is_draw ? "text-cyan-300" : "text-yellow-400") : featured.status === "EM_ANDAMENTO" ? "text-green-400" : featured.status === "PAUSADA" ? "text-yellow-400" : "text-cyan-300"}>
              {finished ? (featured.is_draw ? "EMPATE" : "ENCERRADA") : featured.status}
            </span>
          </div>
        </div>

        {/* Post-match banner */}
        {finished && (
          <div className="mt-3 animate-kop-slam">
            <div className="inline-block px-4 py-1 border-2 border-yellow-500 bg-black/90 kop-glow-gold font-arcade text-lg sm:text-2xl text-yellow-400 uppercase tracking-widest">
              ● PARTIDA FINALIZADA ●
            </div>
          </div>
        )}

        <div className="w-full max-w-6xl mt-6 grid grid-cols-[1fr,auto,1fr] gap-3 sm:gap-6 items-start">
          <HPBar alive={aliveA} total={rosterA.length || 3} mirror={true} color="red" teamName={teamA?.name || "TEAM A"} roster={rosterA} eliminatedIds={eliminatedIds} />
          <div data-testid="live-timer" className={`font-mono-num font-black leading-none ${secs <= 10 && featured.status === "EM_ANDAMENTO" ? "text-red-500 animate-kop-pulse" : featured.status === "PAUSADA" ? "text-yellow-400" : finished ? "text-slate-500" : "text-white"}`}
               style={{ fontSize: "clamp(2.5rem, 8vw, 5.5rem)", letterSpacing: "0.05em" }}>
            {fmtTime(remainingMs)}
          </div>
          <HPBar alive={aliveB} total={rosterB.length || 3} mirror={false} color="cyan" teamName={teamB?.name || "TEAM B"} roster={rosterB} eliminatedIds={eliminatedIds} />
        </div>

        <div className="w-full max-w-6xl mt-6 grid grid-cols-[1fr,auto,1fr] gap-3 sm:gap-8 items-center">
          <div className="text-center">
            <div className={`font-mono-num text-3xl sm:text-5xl font-black ${finished && featured.winner_team_id === featured.team_a ? "text-yellow-400" : "text-white"} mb-1`}>{featured.elims_a}</div>
            {finished && <div className="font-arcade text-xl text-cyan-300">{featured.points_a} PTS</div>}
            <div className="text-[10px] font-display tracking-widest uppercase text-slate-500 mb-2">Eliminações</div>
            <div className="flex justify-center gap-2 flex-wrap">{rosterA.map(p => <PlayerCard key={p.id} player={p} size="md" eliminated={eliminatedIds.has(p.id)} showLevel={false} />)}</div>
          </div>
          <div className="font-arcade text-4xl sm:text-7xl text-white animate-kop-slam" style={{ textShadow: "0 0 40px rgba(255,46,76,1)" }}>VS</div>
          <div className="text-center">
            <div className={`font-mono-num text-3xl sm:text-5xl font-black ${finished && featured.winner_team_id === featured.team_b ? "text-yellow-400" : "text-white"} mb-1`}>{featured.elims_b}</div>
            {finished && <div className="font-arcade text-xl text-cyan-300">{featured.points_b} PTS</div>}
            <div className="text-[10px] font-display tracking-widest uppercase text-slate-500 mb-2">Eliminações</div>
            <div className="flex justify-center gap-2 flex-wrap">{rosterB.map(p => <PlayerCard key={p.id} player={p} size="md" eliminated={eliminatedIds.has(p.id)} showLevel={false} />)}</div>
          </div>
        </div>

        {finished && (
          <div className="mt-6 text-center">
            {featured.is_draw ? (
              <div className="font-arcade text-3xl sm:text-5xl text-cyan-300 uppercase animate-kop-pulse">DRAW · 0 × 0 PTS</div>
            ) : (
              <div className="font-arcade text-3xl sm:text-5xl text-yellow-400 uppercase animate-kop-pulse">WINNER: {winnerName}</div>
            )}
            {(featured.perfect_a || featured.perfect_b) && (
              <div className="mt-2 inline-block bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-black font-arcade tracking-widest px-4 py-1 kop-glow-gold">PERFECT!</div>
            )}
            <div className="mt-4 text-xs text-slate-500 font-display uppercase tracking-widest animate-kop-flicker">Aguardando o organizador carregar a próxima partida…</div>
          </div>
        )}

        {featured.status === "AGUARDANDO" && (
          <div className="mt-8 font-arcade text-3xl sm:text-5xl text-yellow-400 uppercase tracking-widest animate-kop-pulse">READY</div>
        )}
        {featured.status === "PAUSADA" && (
          <div className="mt-8 font-arcade text-3xl sm:text-5xl text-yellow-400 uppercase tracking-widest animate-kop-flicker">PAUSED</div>
        )}
      </div>

      {showBigCountdown && (
        <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center">
          <div className="font-arcade font-black text-red-500 animate-kop-slam" style={{ fontSize: "clamp(8rem, 40vw, 24rem)", textShadow: "0 0 80px rgba(255,46,76,1)" }}>{secs}</div>
        </div>
      )}
      {overlay?.type === "ELIM" && (
        <div className="fixed inset-x-0 top-1/3 z-50 pointer-events-none flex flex-col items-center animate-kop-slam">
          <div className="font-arcade text-5xl sm:text-7xl text-red-500 uppercase tracking-widest" style={{ textShadow: "0 0 40px rgba(255,46,76,1)" }}>ELIMINATED!</div>
          <div className="font-arcade text-3xl text-white uppercase mt-2">{overlay.victim.name}</div>
        </div>
      )}
      {overlay?.type === "FIGHT" && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
          <div className="font-arcade text-red-500 animate-kop-slam font-black uppercase" style={{ fontSize: "clamp(6rem, 25vw, 20rem)", textShadow: "0 0 80px rgba(255,46,76,1)" }}>FIGHT!</div>
        </div>
      )}
      {overlay?.type === "WINNER" && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/70">
          <div className="text-center animate-kop-slam">
            <div className="font-arcade text-yellow-400 font-black uppercase animate-kop-pulse" style={{ fontSize: "clamp(4rem, 15vw, 10rem)" }}>WINNER</div>
            <div className="font-arcade text-white text-3xl sm:text-5xl uppercase mt-2">{teams.find(t => t.id === overlay.match.winner_team_id)?.name}</div>
          </div>
        </div>
      )}
      {overlay?.type === "DRAW" && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/70">
          <div className="text-center animate-kop-slam">
            <div className="font-arcade text-cyan-300 font-black uppercase animate-kop-pulse" style={{ fontSize: "clamp(4rem, 15vw, 10rem)" }}>DRAW</div>
            <div className="font-display text-slate-300 uppercase tracking-widest mt-2">Sem vencedor</div>
          </div>
        </div>
      )}
      {overlay?.type === "PERFECT" && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/80">
          <div className="text-center animate-kop-slam">
            <div className="font-arcade font-black uppercase animate-kop-pulse" style={{ fontSize: "clamp(5rem, 18vw, 14rem)", background: "linear-gradient(90deg,#f59e0b,#ff2e4c,#f59e0b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textShadow: "0 0 80px rgba(234,179,8,0.9)" }}>PERFECT!</div>
            <div className="font-arcade text-3xl sm:text-5xl text-white uppercase mt-2">{teams.find(t => t.id === overlay.match.winner_team_id)?.name}</div>
          </div>
        </div>
      )}
    </div>
  );
}

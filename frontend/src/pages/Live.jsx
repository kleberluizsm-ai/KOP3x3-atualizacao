import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { PlayerCard } from "../components/PlayerCard";
import { sfx } from "../sound";

function fmtTime(ms) {
  const totalS = Math.max(0, Math.round(ms / 1000));
  const m = String(Math.floor(totalS / 60)).padStart(2, "0");
  const s = String(totalS % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default function Live() {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [tick, setTick] = useState(0);
  const [overlay, setOverlay] = useState(null); // {type, ...}
  const lastEliminationsRef = useRef({}); // per match id -> count
  const lastStatusRef = useRef({});
  const lastCountdownRef = useRef({});

  const load = async () => {
    const [m, t, p] = await Promise.all([api.get("/matches"), api.get("/teams"), api.get("/players")]);
    setMatches(m.data); setTeams(t.data); setPlayers(p.data);
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 1500);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 250);
    return () => clearInterval(iv);
  }, []);

  const byId = Object.fromEntries(players.map(p => [p.id, p]));

  // Featured: prefer running match, else next upcoming, else last finished
  const featured = useMemo(() => {
    return matches.find(m => m.status === "EM_ANDAMENTO")
      || matches.find(m => m.status === "PAUSADA")
      || matches.find(m => m.status === "AGUARDANDO")
      || [...matches].reverse().find(m => m.status === "ENCERRADA");
  }, [matches]);

  const remainingMs = useMemo(() => {
    if (!featured) return 0;
    if (featured.status === "EM_ANDAMENTO" && featured.started_at) {
      const started = new Date(featured.started_at).getTime();
      const elapsed = Date.now() - started - (featured.pause_accumulated_ms || 0);
      return Math.max(0, featured.duration_seconds * 1000 - elapsed);
    }
    return featured.remaining_ms ?? (featured.duration_seconds || 300) * 1000;
  }, [featured, tick]);

  // Detect new eliminations to flash overlay
  useEffect(() => {
    if (!featured) return;
    const key = featured.id;
    const cur = (featured.eliminations || []).length;
    const prev = lastEliminationsRef.current[key] || 0;
    if (cur > prev && featured.eliminations?.length) {
      const last = featured.eliminations[featured.eliminations.length - 1];
      const victim = byId[last.eliminated_id];
      if (victim) {
        sfx.elim();
        setOverlay({ type: "ELIM", victim });
        setTimeout(() => setOverlay(null), 2200);
      }
    }
    lastEliminationsRef.current[key] = cur;

    // Time warnings when live
    if (featured.status === "EM_ANDAMENTO") {
      const secs = Math.ceil(remainingMs / 1000);
      const cd = lastCountdownRef.current[key] || {};
      if (secs === 60 && !cd[60]) { cd[60] = true; sfx.timeWarn(); }
      if (secs === 30 && !cd[30]) { cd[30] = true; sfx.timeWarn(); }
      if (secs <= 10 && secs > 0 && !cd[secs]) { cd[secs] = true; sfx.countdown(); }
      lastCountdownRef.current[key] = cd;
    }

    // Status transitions
    const prevStatus = lastStatusRef.current[key];
    if (prevStatus && prevStatus !== featured.status) {
      if (featured.status === "EM_ANDAMENTO") {
        sfx.fight();
        setOverlay({ type: "FIGHT" }); setTimeout(() => setOverlay(null), 1500);
      } else if (featured.status === "ENCERRADA") {
        if (featured.perfect_a || featured.perfect_b) {
          sfx.perfect(); setOverlay({ type: "PERFECT", match: featured });
          setTimeout(() => setOverlay(null), 4000);
        } else if (featured.is_draw) {
          sfx.draw(); setOverlay({ type: "DRAW", match: featured });
          setTimeout(() => setOverlay(null), 3000);
        } else {
          sfx.winner(); setOverlay({ type: "WINNER", match: featured });
          setTimeout(() => setOverlay(null), 3500);
        }
      }
    }
    lastStatusRef.current[key] = featured.status;
  }, [featured?.eliminations?.length, featured?.status, remainingMs]);

  if (!featured) return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <div className="font-arcade text-6xl text-red-500 uppercase animate-kop-pulse">KOP 3x3</div>
        <div className="mt-4 text-slate-500 font-display uppercase tracking-widest">Aguardando início do torneio</div>
        <Link to="/" className="mt-6 inline-block text-xs text-slate-600 uppercase font-display">← sair do modo telão</Link>
      </div>
    </div>
  );

  const teamA = teams.find(t => t.id === featured.team_a);
  const teamB = teams.find(t => t.id === featured.team_b);
  const rosterA = (teamA?.players || []).map(pid => byId[pid]).filter(Boolean);
  const rosterB = (teamB?.players || []).map(pid => byId[pid]).filter(Boolean);
  const eliminatedIds = new Set((featured.eliminations || []).map(e => e.eliminated_id));
  const secs = Math.ceil(remainingMs / 1000);
  const showBigCountdown = featured.status === "EM_ANDAMENTO" && secs <= 10 && secs > 0;

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      <div className="absolute inset-0 kop-grid-bg opacity-30" />
      <div className="scanlines absolute inset-0 opacity-50" />
      <Link to="/" className="absolute top-4 left-4 z-30 text-xs font-display text-slate-600 hover:text-white uppercase tracking-widest">← EXIT</Link>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
        <div className="font-arcade text-red-500 text-sm sm:text-lg tracking-[0.5em] uppercase animate-kop-flicker">KINGS OF PAINTBALL — LIVE</div>
        <div className="font-arcade text-2xl sm:text-4xl text-white uppercase tracking-widest mt-2">MATCH {String(featured.number).padStart(2, "0")}</div>
        <div className="font-display text-xs sm:text-sm text-cyan-300 uppercase tracking-widest">
          {featured.phase === "GROUP" ? `Grupo ${featured.group}` : featured.phase}
          {" · "}
          <span className={
            featured.status === "EM_ANDAMENTO" ? "text-green-400" :
            featured.status === "PAUSADA" ? "text-yellow-400" :
            featured.status === "ENCERRADA" ? "text-slate-500" : "text-cyan-300"
          }>{featured.status}</span>
        </div>

        {/* Big timer */}
        <div
          data-testid="live-timer"
          className={`mt-4 font-mono-num font-black leading-none ${secs <= 10 && featured.status === "EM_ANDAMENTO" ? "text-red-500 animate-kop-pulse" : featured.status === "PAUSADA" ? "text-yellow-400" : "text-white"}`}
          style={{ fontSize: "clamp(3rem, 12vw, 8rem)", letterSpacing: "0.05em", textShadow: featured.status === "EM_ANDAMENTO" ? "0 0 40px rgba(255,46,76,0.6)" : "0 0 20px rgba(255,255,255,0.3)" }}
        >
          {fmtTime(remainingMs)}
        </div>

        <div className="grid grid-cols-[1fr,auto,1fr] gap-3 sm:gap-8 items-center w-full max-w-6xl mt-6">
          <div className="text-center">
            <div className="font-arcade text-2xl sm:text-4xl text-red-400 uppercase animate-kop-pulse mb-3 truncate">{teamA?.name}</div>
            <div className="font-mono-num text-5xl sm:text-7xl font-black text-yellow-400 mb-3">{featured.elims_a}</div>
            <div className="flex justify-center gap-2 flex-wrap">{rosterA.map(p => <PlayerCard key={p.id} player={p} size="md" eliminated={eliminatedIds.has(p.id)} showLevel={false} />)}</div>
          </div>
          <div className="font-arcade text-5xl sm:text-8xl text-white animate-kop-slam" style={{ textShadow: "0 0 40px rgba(255,46,76,1)" }}>VS</div>
          <div className="text-center">
            <div className="font-arcade text-2xl sm:text-4xl text-cyan-300 uppercase animate-kop-pulse mb-3 truncate">{teamB?.name}</div>
            <div className="font-mono-num text-5xl sm:text-7xl font-black text-yellow-400 mb-3">{featured.elims_b}</div>
            <div className="flex justify-center gap-2 flex-wrap">{rosterB.map(p => <PlayerCard key={p.id} player={p} size="md" eliminated={eliminatedIds.has(p.id)} showLevel={false} />)}</div>
          </div>
        </div>

        {featured.status === "AGUARDANDO" && (
          <div className="mt-8 font-arcade text-3xl sm:text-5xl text-yellow-400 uppercase tracking-widest animate-kop-pulse">READY</div>
        )}
        {featured.status === "PAUSADA" && (
          <div className="mt-8 font-arcade text-3xl sm:text-5xl text-yellow-400 uppercase tracking-widest animate-kop-flicker">PAUSED</div>
        )}
      </div>

      {/* Overlays */}
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
            <div className="font-arcade font-black uppercase animate-kop-pulse" style={{
              fontSize: "clamp(5rem, 18vw, 14rem)",
              background: "linear-gradient(90deg,#f59e0b,#ff2e4c,#f59e0b)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              textShadow: "0 0 80px rgba(234,179,8,0.9)",
            }}>PERFECT!</div>
            <div className="font-arcade text-3xl sm:text-5xl text-white uppercase mt-2">{teams.find(t => t.id === overlay.match.winner_team_id)?.name}</div>
            <div className="font-display text-cyan-300 tracking-widest uppercase mt-1">3/3 PLAYERS ALIVE</div>
          </div>
        </div>
      )}
    </div>
  );
}

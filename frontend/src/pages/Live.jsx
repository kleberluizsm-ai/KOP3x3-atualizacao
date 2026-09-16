import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { PlayerCard } from "../components/PlayerCard";

export default function Live() {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [idx, setIdx] = useState(0);

  const load = async () => {
    const [m, t, p] = await Promise.all([api.get("/matches"), api.get("/teams"), api.get("/players")]);
    setMatches(m.data); setTeams(t.data); setPlayers(p.data);
  };
  useEffect(() => {
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, []);

  // Highlight most recent finished match, or next upcoming
  const finished = matches.filter(m => m.status === "ENCERRADA");
  const upcoming = matches.filter(m => m.status !== "ENCERRADA");
  const featured = upcoming[0] || finished[finished.length - 1];

  useEffect(() => {
    const iv = setInterval(() => setIdx(i => i + 1), 10000);
    return () => clearInterval(iv);
  }, []);

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
  const byId = Object.fromEntries(players.map(p => [p.id, p]));
  const roster = (t) => (t?.players || []).map(pid => byId[pid]).filter(Boolean);
  const showWinner = featured.status === "ENCERRADA";

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      <div className="absolute inset-0 kop-grid-bg opacity-30" />
      <div className="scanlines absolute inset-0 opacity-50" />
      <Link to="/" className="absolute top-4 left-4 z-30 text-xs font-display text-slate-600 hover:text-white uppercase tracking-widest">← EXIT</Link>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
        <div className="font-arcade text-red-500 text-sm sm:text-lg tracking-[0.5em] uppercase animate-kop-flicker">KINGS OF PAINTBALL — LIVE</div>
        <div className="font-arcade text-2xl sm:text-4xl text-white uppercase tracking-widest mt-2">MATCH {String(featured.number).padStart(2, "0")}</div>
        <div className="font-display text-xs sm:text-sm text-cyan-300 uppercase tracking-widest">{featured.phase === "GROUP" ? `Grupo ${featured.group}` : featured.phase}</div>

        <div className="grid grid-cols-[1fr,auto,1fr] gap-3 sm:gap-8 items-center w-full max-w-6xl mt-8">
          <div className="text-center">
            <div className="font-arcade text-3xl sm:text-5xl text-red-400 uppercase animate-kop-pulse mb-4">{teamA?.name}</div>
            <div className="flex justify-center gap-2 flex-wrap">{roster(teamA).map(p => <PlayerCard key={p.id} player={p} size="md" />)}</div>
            {showWinner && <div className="font-arcade text-6xl text-yellow-400 mt-4 font-mono-num">{featured.points_a}</div>}
          </div>
          <div className="font-arcade text-7xl sm:text-9xl text-white animate-kop-slam" style={{ textShadow: "0 0 40px rgba(255,46,76,1)" }}>VS</div>
          <div className="text-center">
            <div className="font-arcade text-3xl sm:text-5xl text-cyan-300 uppercase animate-kop-pulse mb-4">{teamB?.name}</div>
            <div className="flex justify-center gap-2 flex-wrap">{roster(teamB).map(p => <PlayerCard key={p.id} player={p} size="md" />)}</div>
            {showWinner && <div className="font-arcade text-6xl text-yellow-400 mt-4 font-mono-num">{featured.points_b}</div>}
          </div>
        </div>

        {showWinner ? (
          <div className="mt-8 text-center animate-kop-slam">
            <div className="font-arcade text-4xl sm:text-6xl text-yellow-400 uppercase tracking-widest animate-kop-pulse">WINNER</div>
            <div className="font-arcade text-3xl sm:text-5xl text-white uppercase mt-2">
              {teams.find(t => t.id === featured.winner_team_id)?.name}
            </div>
          </div>
        ) : (
          <div className="mt-8 font-arcade text-4xl sm:text-6xl text-yellow-400 uppercase tracking-widest animate-kop-pulse">FIGHT!</div>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { PlayerCard } from "../components/PlayerCard";

export default function Versus() {
  const { mid } = useParams();
  const [match, setMatch] = useState(null);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    Promise.all([api.get(`/matches/${mid}`), api.get("/teams"), api.get("/players")]).then(([m, t, p]) => {
      setMatch(m.data); setTeams(t.data); setPlayers(p.data);
    });
  }, [mid]);

  if (!match) return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando...</div>;

  const teamA = teams.find(t => t.id === match.team_a);
  const teamB = teams.find(t => t.id === match.team_b);
  const byId = Object.fromEntries(players.map(p => [p.id, p]));
  const roster = (t) => (t?.players || []).map(pid => byId[pid]).filter(Boolean);

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      <div className="absolute inset-0 kop-grid-bg opacity-30" />
      <div className="absolute inset-0 kop-diag-bg" />
      <div className="scanlines absolute inset-0" />
      <Link to={`/matches/${mid}`} className="absolute top-4 left-4 z-30 text-xs font-display text-slate-500 hover:text-white uppercase tracking-widest">← Voltar</Link>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-10">
        <div className="text-center mb-4 animate-kop-slam">
          <div className="font-arcade text-red-500 text-sm tracking-[0.4em] uppercase">KOP 3x3</div>
          <div className="font-display text-2xl text-cyan-300 uppercase tracking-widest">{match.phase === "GROUP" ? `Grupo ${match.group}` : match.phase} — Match {String(match.number).padStart(2, "0")}</div>
        </div>

        <div className="grid grid-cols-[1fr,auto,1fr] gap-2 sm:gap-6 items-center w-full max-w-5xl">
          <div className="text-center">
            <div className="font-arcade text-2xl sm:text-4xl text-red-400 uppercase mb-3 animate-kop-pulse">{teamA?.name}</div>
            <div className="flex justify-center gap-2 flex-wrap">
              {roster(teamA).map(p => <PlayerCard key={p.id} player={p} size="md" />)}
            </div>
          </div>

          <div className="relative">
            <div className="font-arcade text-6xl sm:text-9xl text-white animate-kop-slam" style={{ textShadow: "0 0 30px rgba(255,46,76,0.9)" }}>VS</div>
          </div>

          <div className="text-center">
            <div className="font-arcade text-2xl sm:text-4xl text-cyan-300 uppercase mb-3 animate-kop-pulse">{teamB?.name}</div>
            <div className="flex justify-center gap-2 flex-wrap">
              {roster(teamB).map(p => <PlayerCard key={p.id} player={p} size="md" />)}
            </div>
          </div>
        </div>

        <div className="mt-10 font-arcade text-4xl sm:text-6xl text-yellow-400 uppercase tracking-widest animate-kop-pulse">FIGHT!</div>
      </div>
    </div>
  );
}

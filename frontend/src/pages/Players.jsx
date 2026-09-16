import React, { useEffect, useState } from "react";
import { api } from "../api";
import { PlayerCard } from "../components/PlayerCard";

export default function Players() {
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  useEffect(() => {
    Promise.all([api.get("/players"), api.get("/teams")]).then(([p, t]) => {
      setPlayers(p.data); setTeams(t.data);
    });
  }, []);
  const teamName = (id) => teams.find(t => t.id === id)?.name;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="font-display text-cyan-300 text-xs tracking-[0.4em] uppercase">Roster</div>
        <h1 className="font-arcade text-3xl text-red-500 uppercase">Jogadores Inscritos</h1>
        <div className="text-slate-500 font-mono-num text-sm mt-1">{players.length} PLAYERS</div>
      </div>
      {players.length === 0 ? (
        <div className="text-slate-500 text-center py-20 font-display uppercase tracking-widest">Nenhum jogador ainda</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {players.map(p => (
            <PlayerCard key={p.id} player={p} team={teamName(p.team_id)} size="md" testId={`player-card-${p.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}

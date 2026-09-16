import React, { useEffect, useState } from "react";
import { api } from "../api";
import { PlayerCard } from "../components/PlayerCard";

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  useEffect(() => {
    Promise.all([api.get("/teams"), api.get("/players")]).then(([t, p]) => {
      setTeams(t.data); setPlayers(p.data);
    });
  }, []);
  const byId = Object.fromEntries(players.map(p => [p.id, p]));

  const groupA = teams.filter(t => t.group === "A");
  const groupB = teams.filter(t => t.group === "B");

  const TeamBlock = ({ t, groupColor }) => (
    <div className="bg-black/70 border-2 border-slate-800 kop-chamfer p-3" data-testid={`team-block-${t.id}`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`font-arcade text-lg ${groupColor} uppercase tracking-wider truncate`}>{t.name}</div>
        <div className="text-xs text-slate-500 font-mono-num">GRP {t.group}</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map(i => {
          const p = byId[t.players?.[i]];
          return p ? <PlayerCard key={i} player={p} size="sm" showLevel={false} /> : (
            <div key={i} className="w-full aspect-[3/4] kop-chamfer border-2 border-dashed border-slate-800 flex items-center justify-center text-slate-700 font-arcade text-2xl">?</div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div>
        <div className="font-display text-cyan-300 text-xs tracking-[0.4em] uppercase">Teams & Groups</div>
        <h1 className="font-arcade text-3xl text-red-500 uppercase">Equipes KOP 3x3</h1>
      </div>
      <div>
        <div className="font-arcade text-2xl text-red-400 mb-3 uppercase">Grupo A</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{groupA.map(t => <TeamBlock key={t.id} t={t} groupColor="text-red-400" />)}</div>
      </div>
      <div>
        <div className="font-arcade text-2xl text-cyan-300 mb-3 uppercase">Grupo B</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{groupB.map(t => <TeamBlock key={t.id} t={t} groupColor="text-cyan-300" />)}</div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function Playoffs() {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  useEffect(() => {
    Promise.all([api.get("/playoffs"), api.get("/teams")]).then(([p, t]) => {
      setMatches(p.data); setTeams(t.data);
    });
  }, []);
  const tname = id => teams.find(t => t.id === id)?.name || "TBD";

  const semis = matches.filter(m => m.phase === "SEMI");
  const finalM = matches.find(m => m.phase === "FINAL");
  const third = matches.find(m => m.phase === "THIRD");

  const Card = ({ m, label, color }) => m ? (
    <Link to={`/matches/${m.id}`} className="block bg-black/70 border-2 border-slate-800 hover:border-red-500 kop-chamfer p-4 transition">
      <div className={`font-arcade text-xs ${color} tracking-widest uppercase mb-2`}>{label}</div>
      <div className="flex items-center justify-between font-display uppercase text-white">
        <span className={m.winner_team_id === m.team_a ? "text-yellow-400" : ""}>{tname(m.team_a)}</span>
        <span className="text-red-400 font-arcade">VS</span>
        <span className={m.winner_team_id === m.team_b ? "text-yellow-400" : ""}>{tname(m.team_b)}</span>
      </div>
      {m.status === "ENCERRADA" && <div className="text-center mt-2 text-cyan-300 font-mono-num text-sm">{m.points_a} · {m.points_b}</div>}
    </Link>
  ) : (
    <div className="bg-black/40 border-2 border-dashed border-slate-800 kop-chamfer p-4 text-center text-slate-600 font-display uppercase tracking-widest text-xs">
      {label} — Aguardando
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6 text-center">
        <div className="font-display text-cyan-300 text-xs tracking-[0.4em] uppercase">Elimination Round</div>
        <h1 className="font-arcade text-4xl text-red-500 uppercase animate-kop-pulse">Mata-Mata</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-4 items-center">
        <div className="space-y-3">
          <Card m={semis[0]} label="Semifinal 1" color="text-red-400" />
          <Card m={semis[1]} label="Semifinal 2" color="text-red-400" />
        </div>
        <div>
          <Card m={finalM} label="🏆 GRANDE FINAL" color="text-yellow-400" />
        </div>
        <div>
          <Card m={third} label="🥉 3º Lugar" color="text-orange-400" />
        </div>
      </div>
    </div>
  );
}

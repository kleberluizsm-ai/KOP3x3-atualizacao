import React, { useEffect, useState } from "react";
import { api } from "../api";

export default function Standings() {
  const [s, setS] = useState({ A: [], B: [] });
  useEffect(() => { api.get("/standings").then(r => setS(r.data)); }, []);

  const Table = ({ rows, name, color }) => (
    <div className="mb-8">
      <div className={`font-arcade text-2xl ${color} uppercase mb-2 tracking-widest`}>Grupo {name}</div>
      <div className="overflow-auto border border-slate-800 kop-chamfer">
        <table className="w-full text-sm">
          <thead className="bg-black/70 text-slate-500 uppercase text-xs">
            <tr>
              <th className="p-2 text-left">POS</th>
              <th className="p-2 text-left">Equipe</th>
              <th className="p-2 text-right">J</th>
              <th className="p-2 text-right">V</th>
              <th className="p-2 text-right">E</th>
              <th className="p-2 text-right">D</th>
              <th className="p-2 text-right">ELIMS</th>
              <th className="p-2 text-right">SAL</th>
              <th className="p-2 text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.team_id} data-testid={`standing-row-${r.team_id}`} className={`border-t border-slate-800 ${i < 2 ? "bg-red-500/10" : ""}`}>
                <td className="p-2 font-mono-num text-red-400">{i === 0 ? "🥇" : i === 1 ? "🥈" : `${i + 1}º`}</td>
                <td className="p-2 font-display uppercase text-white">{r.team_name}</td>
                <td className="p-2 text-right font-mono-num">{r.played}</td>
                <td className="p-2 text-right font-mono-num text-green-400">{r.wins}</td>
                <td className="p-2 text-right font-mono-num text-cyan-300">{r.draws}</td>
                <td className="p-2 text-right font-mono-num text-red-400">{r.losses}</td>
                <td className="p-2 text-right font-mono-num text-cyan-300">{r.elims_for}/{r.elims_against}</td>
                <td className={`p-2 text-right font-mono-num ${r.diff > 0 ? "text-green-400" : r.diff < 0 ? "text-red-400" : "text-slate-400"}`}>{r.diff > 0 ? "+" : ""}{r.diff}</td>
                <td className="p-2 text-right font-arcade text-yellow-400">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="font-display text-cyan-300 text-xs tracking-[0.4em] uppercase">Ranking</div>
        <h1 className="font-arcade text-3xl text-red-500 uppercase">Classificação</h1>
        <div className="text-slate-500 text-xs mt-1 font-display tracking-widest uppercase">
          Pts = Eliminações realizadas · V = Vitória · E = Empate · D = Derrota · SAL = Saldo
        </div>
      </div>
      <Table rows={s.A} name="A" color="text-red-400" />
      <Table rows={s.B} name="B" color="text-cyan-300" />
    </div>
  );
}

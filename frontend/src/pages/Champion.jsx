import React, { useEffect, useState } from "react";
import { api } from "../api";
import { PlayerCard } from "../components/PlayerCard";
import { useAuth } from "../auth";
import { toast } from "sonner";

export default function Champion() {
  const { isAdmin } = useAuth();
  const [ch, setCh] = useState(null);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const load = () => Promise.all([api.get("/champion"), api.get("/teams"), api.get("/players")]).then(([c, t, p]) => {
    setCh(c.data); setTeams(t.data); setPlayers(p.data);
  });
  useEffect(() => { load(); }, []);

  const byId = Object.fromEntries(players.map(p => [p.id, p]));
  const teamById = Object.fromEntries(teams.map(t => [t.id, t]));

  const podium = (tid, place) => {
    const t = teamById[tid];
    if (!t) return null;
    const border = place === 1 ? "border-yellow-400 kop-glow-gold" : place === 2 ? "border-slate-300" : "border-orange-400";
    const label = place === 1 ? "🏆 CAMPEÃO" : place === 2 ? "🥈 VICE" : "🥉 3º LUGAR";
    const color = place === 1 ? "text-yellow-400" : place === 2 ? "text-slate-300" : "text-orange-400";
    return (
      <div className={`border-4 ${border} kop-chamfer bg-black/70 p-4 text-center`} data-testid={`podium-${place}`}>
        <div className={`font-arcade text-2xl ${color} uppercase tracking-widest mb-2`}>{label}</div>
        <div className="font-arcade text-3xl text-white uppercase animate-kop-pulse">{t.name}</div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {(t.players || []).map(pid => byId[pid] && <PlayerCard key={pid} player={byId[pid]} size="sm" showLevel={false} />)}
        </div>
      </div>
    );
  };

  const setMvp = async (pid) => {
    await api.post("/champion/mvp", { player_id: pid });
    toast.success("MVP definido");
    load();
  };

  const winnerPlayers = ch?.first ? (teamById[ch.first]?.players || []).map(pid => byId[pid]).filter(Boolean) : [];
  const mvp = ch?.mvp_player_id ? byId[ch.mvp_player_id] : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 text-center">
      <div className="font-display text-cyan-300 text-xs tracking-[0.4em] uppercase">Trophy Ceremony</div>
      <h1 className="font-arcade text-4xl sm:text-5xl text-yellow-400 uppercase animate-kop-pulse mb-8">KOP Champion</h1>

      {!ch?.first && <div className="text-slate-500 font-display uppercase tracking-widest py-20">A definir após a Grande Final</div>}

      <div className="space-y-4">
        {ch?.first && podium(ch.first, 1)}
        <div className="grid sm:grid-cols-2 gap-4">
          {ch?.second && podium(ch.second, 2)}
          {ch?.third && podium(ch.third, 3)}
        </div>
      </div>

      {mvp && (
        <div className="mt-8">
          <div className="font-arcade text-2xl text-cyan-300 uppercase animate-kop-pulse">MVP</div>
          <div className="mt-3 flex justify-center"><PlayerCard player={mvp} size="lg" /></div>
        </div>
      )}

      {isAdmin && ch?.first && (
        <div className="mt-8 bg-black/60 border border-cyan-500/40 kop-chamfer p-5">
          <div className="font-display text-cyan-300 uppercase tracking-widest text-sm mb-3">Escolher MVP (opcional)</div>
          <div className="flex flex-wrap gap-2 justify-center">
            {winnerPlayers.map(p => (
              <button key={p.id} data-testid={`mvp-select-${p.id}`} onClick={() => setMvp(p.id)}
                className={`px-3 py-1 border ${ch.mvp_player_id === p.id ? "border-cyan-400 text-cyan-300" : "border-slate-700 text-slate-300"}`}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

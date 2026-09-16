import React, { useEffect, useState } from "react";
import { api } from "../api";
import { PlayerCard } from "../components/PlayerCard";

export default function TeamSelect() {
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    Promise.all([api.get("/teams"), api.get("/players")]).then(([t, p]) => {
      setTeams(t.data.filter(x => x.players?.length > 0));
      setPlayers(p.data);
    });
  }, []);

  useEffect(() => {
    if (revealed < teams.length) {
      const timer = setTimeout(() => setRevealed(r => r + 1), 800);
      return () => clearTimeout(timer);
    }
  }, [revealed, teams.length]);

  const byId = Object.fromEntries(players.map(p => [p.id, p]));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="text-center mb-8 relative overflow-hidden">
        <div className="font-display text-cyan-300 text-xs tracking-[0.4em] uppercase">KOF Style</div>
        <h1 className="font-arcade text-4xl sm:text-5xl text-red-500 uppercase animate-kop-pulse">Team Select</h1>
      </div>

      {teams.length === 0 ? (
        <div className="text-center py-20 text-slate-500 font-display uppercase tracking-widest">
          Aguardando sorteio do organizador
        </div>
      ) : (
        <>
          <div className="mb-8 overflow-hidden border-y border-red-900/50 py-3 relative">
            <div className="flex gap-4 animate-kop-scroll whitespace-nowrap">
              {[...players, ...players].map((p, i) => (
                <div key={i} className="inline-flex items-center gap-2 shrink-0">
                  <img src={p.photo} alt={p.name} className="w-10 h-10 rounded-full object-cover border-2 border-red-500/60" />
                  <span className="font-display uppercase text-sm text-slate-300 tracking-widest">{p.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            {teams.slice(0, revealed).map((t, idx) => (
              <div key={t.id} className="animate-kop-slam">
                <div className="text-center mb-3">
                  <div className="font-arcade text-2xl sm:text-3xl text-red-400 uppercase" data-testid={`team-select-name-${t.id}`}>{t.name}</div>
                  <div className="text-xs font-display text-cyan-300 tracking-widest uppercase">Team Ready!</div>
                </div>
                <div className="flex justify-center gap-4 flex-wrap">
                  {t.players.map(pid => byId[pid] && (
                    <PlayerCard key={pid} player={byId[pid]} size="lg" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

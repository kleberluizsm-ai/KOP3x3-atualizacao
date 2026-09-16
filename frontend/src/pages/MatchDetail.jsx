import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { PlayerCard } from "../components/PlayerCard";
import { toast } from "sonner";

export default function MatchDetail() {
  const { mid } = useParams();
  const { isAdmin } = useAuth();
  const [match, setMatch] = useState(null);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [winner, setWinner] = useState(null);
  const [elimsA, setElimsA] = useState(0);
  const [elimsB, setElimsB] = useState(0);
  const [elimA, setElimA] = useState([]);
  const [elimB, setElimB] = useState([]);
  const [showResult, setShowResult] = useState(false);

  const load = async () => {
    const [m, t, p] = await Promise.all([
      api.get(`/matches/${mid}`), api.get("/teams"), api.get("/players"),
    ]);
    setMatch(m.data); setTeams(t.data); setPlayers(p.data);
    if (m.data.status === "ENCERRADA") {
      setWinner(m.data.winner_team_id);
      setElimsA(m.data.elims_a); setElimsB(m.data.elims_b);
      setElimA(m.data.eliminated_players_a || []);
      setElimB(m.data.eliminated_players_b || []);
    }
  };
  useEffect(() => { load(); }, [mid]);

  if (!match) return <div className="p-8 text-center text-slate-500">Carregando...</div>;

  const teamA = teams.find(t => t.id === match.team_a);
  const teamB = teams.find(t => t.id === match.team_b);
  const byId = Object.fromEntries(players.map(p => [p.id, p]));
  const roster = (t) => (t?.players || []).map(pid => byId[pid]).filter(Boolean);

  const toggle = (arr, setArr, id) => {
    setArr(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  };

  const submit = async () => {
    if (!winner) return toast.error("Escolha o vencedor");
    try {
      await api.post(`/matches/${mid}/result`, {
        winner_team_id: winner,
        elims_a: Math.min(elimsA, 3), elims_b: Math.min(elimsB, 3),
        eliminated_players_a: elimA, eliminated_players_b: elimB,
      });
      toast.success("Resultado registrado!");
      setShowResult(true);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Falha"); }
  };

  const canEdit = isAdmin && !match.locked;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="text-center mb-4">
        <div className="font-arcade text-red-400 text-sm tracking-widest uppercase">MATCH {String(match.number).padStart(2, "0")}</div>
        <div className="font-display text-xs text-cyan-300 tracking-widest uppercase">{match.phase}{match.group ? ` — GRUPO ${match.group}` : ""}</div>
      </div>

      <Link to={`/versus/${mid}`} className="block text-center mb-6 text-xs text-cyan-300 hover:text-cyan-200 font-display tracking-widest uppercase">▶ VER TELA VERSUS</Link>

      <div className="grid md:grid-cols-[1fr,auto,1fr] gap-4 items-center mb-8">
        <div>
          <div className="font-arcade text-2xl text-red-400 uppercase text-center mb-3">{teamA?.name}</div>
          <div className="grid grid-cols-3 gap-2">
            {roster(teamA).map(p => (
              <PlayerCard key={p.id} player={p} eliminated={elimA.includes(p.id)} size="sm" />
            ))}
          </div>
          {canEdit && (
            <>
              <div className="mt-3 text-xs font-display text-slate-400 uppercase tracking-widest">Eliminados</div>
              <div className="flex gap-2 flex-wrap mt-1">
                {roster(teamA).map(p => (
                  <button key={p.id} data-testid={`elim-a-${p.id}`} onClick={() => toggle(elimA, setElimA, p.id)}
                    className={`text-xs px-2 py-1 border ${elimA.includes(p.id) ? "border-red-500 text-red-400 bg-red-500/10" : "border-slate-700 text-slate-400"}`}>
                    {p.name.split(" ")[0]}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-xs font-display text-slate-400 uppercase tracking-widest">Eliminações realizadas</div>
              <input data-testid="elims-a-input" type="number" min={0} max={3} value={elimsA} onChange={e => setElimsA(+e.target.value)} className="w-20 mt-1 bg-slate-900 border border-slate-700 focus:border-red-500 px-2 py-1 text-white" />
            </>
          )}
        </div>
        <div className="font-arcade text-5xl text-red-500 text-center animate-kop-pulse">VS</div>
        <div>
          <div className="font-arcade text-2xl text-cyan-300 uppercase text-center mb-3">{teamB?.name}</div>
          <div className="grid grid-cols-3 gap-2">
            {roster(teamB).map(p => (
              <PlayerCard key={p.id} player={p} eliminated={elimB.includes(p.id)} size="sm" />
            ))}
          </div>
          {canEdit && (
            <>
              <div className="mt-3 text-xs font-display text-slate-400 uppercase tracking-widest">Eliminados</div>
              <div className="flex gap-2 flex-wrap mt-1">
                {roster(teamB).map(p => (
                  <button key={p.id} data-testid={`elim-b-${p.id}`} onClick={() => toggle(elimB, setElimB, p.id)}
                    className={`text-xs px-2 py-1 border ${elimB.includes(p.id) ? "border-red-500 text-red-400 bg-red-500/10" : "border-slate-700 text-slate-400"}`}>
                    {p.name.split(" ")[0]}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-xs font-display text-slate-400 uppercase tracking-widest">Eliminações realizadas</div>
              <input data-testid="elims-b-input" type="number" min={0} max={3} value={elimsB} onChange={e => setElimsB(+e.target.value)} className="w-20 mt-1 bg-slate-900 border border-slate-700 focus:border-red-500 px-2 py-1 text-white" />
            </>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="bg-black/60 border border-red-900/50 kop-chamfer p-5">
          <div className="font-display uppercase tracking-widest text-slate-400 text-xs mb-2">Vencedor</div>
          <div className="flex gap-2">
            <button data-testid="winner-a-btn" onClick={() => setWinner(match.team_a)} className={`flex-1 kop-chamfer border-2 px-4 py-3 font-arcade uppercase tracking-widest ${winner === match.team_a ? "border-red-500 text-red-400 bg-red-500/10 kop-glow-red" : "border-slate-700 text-slate-400"}`}>{teamA?.name}</button>
            <button data-testid="winner-b-btn" onClick={() => setWinner(match.team_b)} className={`flex-1 kop-chamfer border-2 px-4 py-3 font-arcade uppercase tracking-widest ${winner === match.team_b ? "border-cyan-400 text-cyan-300 bg-cyan-500/10 kop-glow-blue" : "border-slate-700 text-slate-400"}`}>{teamB?.name}</button>
          </div>
          <button data-testid="submit-result-btn" onClick={submit} className="mt-4 w-full kop-chamfer bg-red-600 hover:bg-red-500 text-white font-arcade uppercase tracking-widest py-3 kop-glow-red">
            ▶ Registrar Resultado
          </button>
        </div>
      )}

      {match.status === "ENCERRADA" && (
        <div className="mt-6 text-center animate-kop-slam">
          <div className="font-arcade text-5xl text-yellow-400 uppercase animate-kop-pulse">WINNER</div>
          <div className="font-arcade text-3xl text-white uppercase mt-1">
            {teams.find(t => t.id === match.winner_team_id)?.name}
          </div>
          <div className="mt-2 font-mono-num text-2xl text-cyan-300">
            {match.points_a} <span className="text-slate-600">·</span> {match.points_b} PTS
          </div>
          {(match.perfect_a || match.perfect_b) && (
            <div className="mt-3 inline-block bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-black font-arcade tracking-widest px-4 py-1 kop-glow-gold animate-pulse">
              PERFECT! 3/3 PLAYERS ALIVE
            </div>
          )}
        </div>
      )}
    </div>
  );
}

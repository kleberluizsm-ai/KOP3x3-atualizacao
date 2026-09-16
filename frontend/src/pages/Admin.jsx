import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { toast } from "sonner";
import { sfx } from "../sound";
import { Shuffle, Trash2, RefreshCw, Lock, Unlock, Tv, Trophy, Swords, SkipForward } from "lucide-react";

export default function Admin() {
  const { isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const [tour, setTour] = useState(null);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [live, setLive] = useState({ mode: "MATCH", match_id: null });
  const [mode, setMode] = useState("BALANCED");

  useEffect(() => {
    if (!loading && !isAdmin) nav("/login");
  }, [isAdmin, loading, nav]);

  const load = async () => {
    const [t, tm, p, m, l] = await Promise.all([
      api.get("/tournament"), api.get("/teams"),
      api.get("/players"), api.get("/matches"),
      api.get("/live/state"),
    ]);
    setTour(t.data); setTeams(tm.data); setPlayers(p.data); setMatches(m.data); setLive(l.data);
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);
  // Poll live state so admin sees external changes and next-match auto-selection
  useEffect(() => {
    if (!isAdmin) return;
    const iv = setInterval(() => api.get("/live/state").then(r => setLive(r.data)).catch(()=>{}), 3000);
    return () => clearInterval(iv);
  }, [isAdmin]);

  const runDraw = async () => {
    if (!confirm("Executar sorteio? Isso substituirá as equipes atuais e regenerará a tabela.")) return;
    try {
      await api.post("/draw", { num_teams: tour?.num_teams || 10, players_per_team: tour?.players_per_team || 3, mode });
      toast.success("Sorteio concluído!"); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Falha"); }
  };
  const reset = async () => {
    if (!confirm("RESETAR o torneio? Todos os jogos e sorteios serão apagados.")) return;
    await api.post("/tournament/reset"); toast.success("Torneio reiniciado"); load();
  };
  const removePlayer = async (id) => {
    if (!confirm("Excluir jogador?")) return;
    await api.delete(`/players/${id}`); load();
  };
  const toggleLock = async (id) => { await api.post(`/matches/${id}/lock`); load(); };
  const renameTeam = async (id, name) => { await api.patch(`/teams/${id}`, { name }); load(); };

  const setLiveMode = async (nextMode) => {
    try {
      const r = await api.post("/live/state", { mode: nextMode });
      setLive(r.data); sfx.select();
      toast.success(nextMode === "MATCH" ? "Telão: Partida" : "Telão: Classificação");
    } catch (e) { toast.error(e.response?.data?.detail || "Falha"); }
  };
  const pinMatch = async (mid) => {
    try {
      const r = await api.post("/live/state", { mode: "MATCH", match_id: mid });
      setLive(r.data); sfx.confirm();
      toast.success("Partida carregada no telão");
    } catch (e) { toast.error(e.response?.data?.detail || "Falha"); }
  };
  const loadNext = async () => {
    try {
      const r = await api.post("/live/load-next");
      setLive({ mode: r.data.mode, match_id: r.data.match_id });
      sfx.reveal();
      if (r.data.match_id) toast.success("Próxima partida carregada no telão");
      else toast.warning("Sem partidas AGUARDANDO");
    } catch (e) { toast.error(e.response?.data?.detail || "Falha"); }
  };

  if (!isAdmin) return null;

  const pinnedMatch = matches.find(m => m.id === live.match_id);
  const pinnedTeams = pinnedMatch ? [teams.find(t => t.id === pinnedMatch.team_a)?.name, teams.find(t => t.id === pinnedMatch.team_b)?.name] : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div>
        <div className="font-display text-cyan-300 text-xs tracking-[0.4em] uppercase">Control Center</div>
        <h1 data-testid="admin-title" className="font-arcade text-3xl text-red-500 uppercase">Painel do Organizador</h1>
      </div>

      {/* LIVE CONTROLLER */}
      <section className="bg-black/60 border-2 border-cyan-500/40 kop-chamfer p-5">
        <div className="flex items-center gap-2 mb-3">
          <Tv className="w-5 h-5 text-cyan-300" />
          <h2 className="font-display text-xl text-white uppercase tracking-widest">Telão — KOP Live</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <button data-testid="live-mode-match" onClick={() => setLiveMode("MATCH")}
            className={`kop-chamfer border-2 p-3 flex items-center gap-2 justify-center font-arcade uppercase tracking-widest ${live.mode === "MATCH" ? "border-red-500 bg-red-500/10 text-red-400 kop-glow-red" : "border-slate-700 text-slate-400 hover:border-red-500"}`}>
            <Swords className="w-4 h-4" /> Tela de Partida
          </button>
          <button data-testid="live-mode-standings" onClick={() => setLiveMode("STANDINGS")}
            className={`kop-chamfer border-2 p-3 flex items-center gap-2 justify-center font-arcade uppercase tracking-widest ${live.mode === "STANDINGS" ? "border-cyan-400 bg-cyan-500/10 text-cyan-300 kop-glow-blue" : "border-slate-700 text-slate-400 hover:border-cyan-400"}`}>
            <Trophy className="w-4 h-4" /> Classificação
          </button>
        </div>

        <div className="border-t border-slate-800 pt-3 flex flex-wrap items-center gap-3">
          <div className="text-xs font-display uppercase tracking-widest text-slate-400">
            <span className="text-slate-500">Fixada:</span>{" "}
            {pinnedMatch ? (
              <span className="text-white">
                MATCH {String(pinnedMatch.number).padStart(2,"0")} · {pinnedTeams?.[0]} vs {pinnedTeams?.[1]} ·{" "}
                <span className={pinnedMatch.status === "ENCERRADA" ? "text-slate-500" : "text-green-400"}>{pinnedMatch.status}</span>
              </span>
            ) : <span className="text-slate-600">nenhuma (auto)</span>}
          </div>
          <button data-testid="live-load-next" onClick={loadNext}
            className="ml-auto kop-chamfer bg-red-600 hover:bg-red-500 text-white font-arcade uppercase tracking-widest px-4 py-2 flex items-center gap-2 kop-glow-red">
            <SkipForward className="w-4 h-4" /> Carregar Próxima Partida
          </button>
          <Link to="/live" target="_blank" data-testid="open-live-tab"
            className="kop-chamfer border-2 border-cyan-500 text-cyan-300 hover:bg-cyan-500 hover:text-black font-arcade uppercase tracking-widest px-4 py-2 transition">
            Abrir Telão
          </Link>
        </div>
        <div className="mt-3 text-[10px] text-slate-500 font-display uppercase tracking-widest">
          Ao clicar em START numa partida, o telão fixa automaticamente essa partida em modo Match.
        </div>
      </section>

      <section className="bg-black/60 border border-red-900/50 kop-chamfer p-5">
        <h2 className="font-display text-xl text-white uppercase tracking-widest mb-3">Torneio</h2>
        <div className="grid sm:grid-cols-4 gap-3 text-sm">
          <div><div className="text-slate-500 text-xs uppercase">Status</div><div className="font-arcade text-red-400">{tour?.status}</div></div>
          <div><div className="text-slate-500 text-xs uppercase">Equipes</div><div className="font-arcade text-white">{tour?.num_teams}</div></div>
          <div><div className="text-slate-500 text-xs uppercase">Por Equipe</div><div className="font-arcade text-white">{tour?.players_per_team}</div></div>
          <div><div className="text-slate-500 text-xs uppercase">Inscritos</div><div className="font-arcade text-cyan-300">{players.length}</div></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 items-center">
          <div className="flex gap-2">
            {["NORMAL", "BALANCED"].map(m => (
              <button key={m} data-testid={`draw-mode-${m}`} onClick={() => setMode(m)}
                className={`px-3 py-1 text-xs font-display uppercase tracking-widest border-2 kop-chamfer ${mode === m ? "border-red-500 text-red-400 bg-red-500/10" : "border-slate-700 text-slate-400"}`}>
                {m === "BALANCED" ? "Balanceado" : "Normal"}
              </button>
            ))}
          </div>
          <button data-testid="run-draw-btn" onClick={runDraw} className="kop-chamfer bg-red-600 hover:bg-red-500 text-white font-arcade uppercase tracking-widest px-4 py-2 flex items-center gap-2">
            <Shuffle className="w-4 h-4" /> Sortear Equipes
          </button>
          <Link to="/team-select" className="kop-chamfer border-2 border-cyan-500 text-cyan-300 hover:bg-cyan-500 hover:text-black font-arcade uppercase tracking-widest px-4 py-2 transition">
            Ver Team Select
          </Link>
          <button data-testid="reset-btn" onClick={reset} className="kop-chamfer border-2 border-slate-700 text-slate-400 hover:text-red-500 hover:border-red-500 font-arcade uppercase tracking-widest px-4 py-2 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Reset
          </button>
        </div>
      </section>

      <section className="bg-black/60 border border-red-900/50 kop-chamfer p-5">
        <h2 className="font-display text-xl text-white uppercase tracking-widest mb-3">Equipes (renomear)</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {teams.map(t => (
            <div key={t.id} className="flex items-center gap-2 border border-slate-800 p-2">
              <span className="text-slate-500 font-mono-num text-xs">{t.group}</span>
              <input defaultValue={t.name} onBlur={e => e.target.value !== t.name && renameTeam(t.id, e.target.value)}
                data-testid={`team-rename-${t.id}`}
                className="flex-1 bg-transparent text-white font-display uppercase tracking-widest outline-none border-b border-transparent focus:border-red-500" />
              <span className="text-xs text-cyan-300">{t.players?.length || 0}/3</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-black/60 border border-red-900/50 kop-chamfer p-5">
        <h2 className="font-display text-xl text-white uppercase tracking-widest mb-3">Jogadores ({players.length})</h2>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 uppercase">
              <tr><th className="text-left p-1">Nome</th><th className="text-left">Nível</th><th className="text-left">Equipe</th><th></th></tr>
            </thead>
            <tbody>
              {players.map(p => (
                <tr key={p.id} className="border-t border-slate-800">
                  <td className="p-1 text-white">{p.name} {p.nickname && <span className="text-cyan-300 text-xs">"{p.nickname}"</span>}</td>
                  <td className="text-slate-300 text-xs">{p.level}</td>
                  <td className="text-slate-400 text-xs">{teams.find(t => t.id === p.team_id)?.name || "—"}</td>
                  <td className="text-right"><button data-testid={`delete-player-${p.id}`} onClick={() => removePlayer(p.id)} className="text-red-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-black/60 border border-red-900/50 kop-chamfer p-5">
        <h2 className="font-display text-xl text-white uppercase tracking-widest mb-3">Partidas ({matches.length})</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {matches.map(m => {
            const ta = teams.find(t => t.id === m.team_a);
            const tb = teams.find(t => t.id === m.team_b);
            const isPinned = live.match_id === m.id;
            return (
              <div key={m.id} className={`border p-2 flex items-center gap-2 text-sm ${isPinned ? "border-cyan-400 bg-cyan-500/10" : "border-slate-800"}`}>
                <span className="font-mono-num text-xs text-red-400">#{m.number}</span>
                <span className="text-xs text-slate-500 uppercase">{m.phase}{m.group ? "-" + m.group : ""}</span>
                <span className="flex-1 text-white truncate">{ta?.name} vs {tb?.name}</span>
                <span className={`text-xs uppercase ${m.status === "ENCERRADA" ? "text-green-400" : m.status === "EM_ANDAMENTO" ? "text-red-400 animate-kop-pulse" : "text-yellow-400"}`}>{m.status}</span>
                <button data-testid={`pin-live-${m.id}`} onClick={() => pinMatch(m.id)} title="Fixar no telão" className={isPinned ? "text-cyan-300" : "text-slate-500 hover:text-cyan-300"}><Tv className="w-3 h-3" /></button>
                <Link to={`/matches/${m.id}`} data-testid={`match-open-${m.id}`} className="text-cyan-300 text-xs uppercase font-display">Abrir</Link>
                <button data-testid={`match-lock-${m.id}`} onClick={() => toggleLock(m.id)} className="text-slate-400">{m.locked ? <Lock className="w-3 h-3 text-red-400" /> : <Unlock className="w-3 h-3" />}</button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

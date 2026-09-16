import React from "react";

const LEVEL_STYLES = {
  "INICIANTE": "bg-blue-500/25 text-blue-300 border-blue-400",
  "INTERMEDIÁRIO": "bg-amber-500/25 text-amber-300 border-amber-400",
  "PROFISSIONAL": "bg-red-500/25 text-red-300 border-red-400",
};

export function PlayerCard({ player, eliminated = false, size = "md", team, showLevel = true, testId }) {
  const sizes = {
    sm: "w-24 h-32",
    md: "w-36 h-48",
    lg: "w-48 h-64",
    xl: "w-56 h-72",
  };
  return (
    <div
      data-testid={testId}
      className={`relative ${sizes[size]} kop-chamfer border-2 border-slate-700 bg-slate-900 overflow-hidden transition-all duration-300 hover:border-red-500 hover:shadow-[0_0_25px_rgba(255,46,76,0.55)] hover:scale-[1.03] ${eliminated ? "grayscale contrast-125 opacity-60" : ""}`}
    >
      {player?.photo ? (
        <img src={player.photo} alt={player.name} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-slate-500 text-4xl font-arcade">?</div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      {showLevel && player?.level && (
        <div className={`absolute top-2 left-2 text-[10px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 border ${LEVEL_STYLES[player.level] || ""}`}>
          {player.level}
        </div>
      )}
      {team && (
        <div className="absolute top-2 right-2 text-[10px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 bg-black/70 text-red-400 border border-red-500/60">
          {team}
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <div className="font-display text-lg leading-tight text-white uppercase truncate">{player?.name || "—"}</div>
        {player?.nickname && (
          <div className="font-mono-num text-[10px] text-cyan-300 uppercase tracking-widest truncate">"{player.nickname}"</div>
        )}
      </div>
      {eliminated && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="font-arcade text-2xl text-red-500 border-y-4 border-red-500 py-1 px-3 bg-black/70 -rotate-6">
            ELIMINATED
          </div>
        </div>
      )}
    </div>
  );
}

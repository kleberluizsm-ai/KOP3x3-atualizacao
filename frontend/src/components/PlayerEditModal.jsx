import React, { useEffect, useRef, useState } from "react";
import { api, formatErr } from "../api";
import { toast } from "sonner";
import { sfx } from "../sound";
import { Camera, X, Save } from "lucide-react";

const LEVELS = ["INICIANTE", "INTERMEDIÁRIO", "PROFISSIONAL"];
const STATUSES = ["CONFIRMADO", "PENDENTE", "CANCELADO"];

async function fileToBase64(file) {
  const bitmap = await createImageBitmap(file);
  const max = 800;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function PlayerEditModal({ player, onClose, onSaved }) {
  const [name, setName] = useState(player?.name || "");
  const [nickname, setNickname] = useState(player?.nickname || "");
  const [level, setLevel] = useState(player?.level || "INTERMEDIÁRIO");
  const [whatsapp, setWhatsapp] = useState(player?.whatsapp || "");
  const [notes, setNotes] = useState(player?.notes || "");
  const [status, setStatus] = useState(player?.status || "CONFIRMADO");
  const [photo, setPhoto] = useState(player?.photo || null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  if (!player) return null;

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const b64 = await fileToBase64(f);
      setPhoto(b64);
      sfx.select();
    } catch { sfx.error(); toast.error("Falha ao processar foto"); }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) { sfx.error(); return toast.error("Nome obrigatório"); }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        nickname: nickname.trim() || null,
        level,
        whatsapp: whatsapp.trim() || null,
        notes: notes.trim() || null,
        status,
      };
      // Only send photo if it changed (data URL vs original)
      if (photo && photo !== player.photo) payload.photo = photo;
      const r = await api.patch(`/players/${player.id}`, payload);
      sfx.save();
      toast.success("Inscrito atualizado");
      onSaved(r.data);
      onClose();
    } catch (err) {
      sfx.error();
      toast.error(formatErr(err.response?.data?.detail) || "Falha ao salvar");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-slate-950 border-2 border-red-500/60 kop-chamfer p-5 sm:p-7 max-h-[90vh] overflow-auto"
      >
        <button
          type="button"
          data-testid="player-edit-close"
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-red-500 p-1"
          aria-label="Fechar"
        ><X className="w-5 h-5" /></button>

        <div className="mb-4">
          <div className="font-display text-cyan-300 text-xs tracking-[0.4em] uppercase">Admin Edit</div>
          <h2 className="font-arcade text-2xl text-red-500 uppercase">Editar Inscrito</h2>
          <div className="text-[10px] text-slate-500 font-mono-num mt-1">ID {player.id}</div>
        </div>

        <div className="flex flex-col items-center gap-2 mb-5">
          <div
            onClick={() => fileRef.current?.click()}
            data-testid="player-edit-photo-box"
            className="relative w-32 h-32 kop-chamfer border-2 border-dashed border-red-500/60 bg-slate-900 flex items-center justify-center cursor-pointer overflow-hidden hover:border-red-500"
            title="Clique para trocar a foto"
          >
            {photo ? (
              <img src={photo} alt="preview" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center text-slate-500">
                <Camera className="w-7 h-7 mx-auto mb-1" />
                <div className="text-[10px] font-display uppercase tracking-widest">Trocar foto</div>
              </div>
            )}
          </div>
          <input ref={fileRef} data-testid="player-edit-photo-input" type="file" accept="image/*" onChange={onFile} className="hidden" />
          <div className="text-[10px] text-slate-500 font-display uppercase tracking-widest">Clique na foto para substituir</div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-display uppercase tracking-widest text-slate-400">Nome Completo *</label>
            <input data-testid="player-edit-name" value={name} onChange={e => setName(e.target.value)} maxLength={80}
              className="w-full mt-1 bg-slate-900 border border-slate-700 focus:border-red-500 px-3 py-2 text-white outline-none" />
          </div>
          <div>
            <label className="text-xs font-display uppercase tracking-widest text-slate-400">Apelido</label>
            <input data-testid="player-edit-nickname" value={nickname} onChange={e => setNickname(e.target.value)} maxLength={40}
              className="w-full mt-1 bg-slate-900 border border-slate-700 focus:border-red-500 px-3 py-2 text-white outline-none" />
          </div>
          <div>
            <label className="text-xs font-display uppercase tracking-widest text-slate-400">Nível</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {LEVELS.map(l => (
                <button key={l} type="button" data-testid={`player-edit-level-${l}`}
                  onClick={() => { setLevel(l); sfx.select(); }}
                  className={`kop-chamfer border-2 px-2 py-2 font-display uppercase text-[11px] tracking-widest transition ${level === l ? "border-red-500 bg-red-500/20 text-red-400" : "border-slate-700 text-slate-400 hover:border-slate-500"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-display uppercase tracking-widest text-slate-400">Status</label>
              <select data-testid="player-edit-status" value={status} onChange={e => setStatus(e.target.value)}
                className="w-full mt-1 bg-slate-900 border border-slate-700 focus:border-red-500 px-3 py-2 text-white outline-none text-sm">
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-display uppercase tracking-widest text-slate-400">WhatsApp</label>
              <input data-testid="player-edit-whatsapp" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} maxLength={30}
                className="w-full mt-1 bg-slate-900 border border-slate-700 focus:border-red-500 px-3 py-2 text-white outline-none text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-display uppercase tracking-widest text-slate-400">Observação</label>
            <textarea data-testid="player-edit-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} maxLength={300}
              className="w-full mt-1 bg-slate-900 border border-slate-700 focus:border-red-500 px-3 py-2 text-white outline-none" />
          </div>
        </div>

        <div className="mt-6 flex gap-2 justify-end">
          <button type="button" data-testid="player-edit-cancel" onClick={onClose}
            className="kop-chamfer border-2 border-slate-700 text-slate-400 hover:text-slate-200 font-arcade uppercase tracking-widest px-4 py-2">
            Cancelar
          </button>
          <button type="submit" data-testid="player-edit-save" disabled={saving}
            className="kop-chamfer bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-arcade uppercase tracking-widest px-4 py-2 flex items-center gap-2 kop-glow-red">
            <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

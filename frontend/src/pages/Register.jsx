import React, { useState, useRef } from "react";
import { api, formatErr } from "../api";
import { toast } from "sonner";
import { PlayerCard } from "../components/PlayerCard";
import { Camera } from "lucide-react";

const LEVELS = ["INICIANTE", "INTERMEDIÁRIO", "PROFISSIONAL"];

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

export default function Register() {
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [level, setLevel] = useState("INTERMEDIÁRIO");
  const [whatsapp, setWhatsapp] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(null);
  const fileRef = useRef();

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const b64 = await fileToBase64(f);
      setPhoto(b64);
    } catch { toast.error("Não foi possível processar a foto"); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Informe seu nome");
    if (!photo) return toast.error("Envie sua foto");
    setSubmitting(true);
    try {
      const r = await api.post("/players/register", {
        name, nickname: nickname || null, level, photo,
        whatsapp: whatsapp || null, notes: notes || null,
      });
      setConfirmed(r.data);
      toast.success("Inscrição confirmada!");
    } catch (err) {
      toast.error(formatErr(err.response?.data?.detail) || "Falha no envio");
    } finally { setSubmitting(false); }
  };

  if (confirmed) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
        <div className="max-w-md w-full text-center">
          <div className="font-arcade text-cyan-300 text-sm tracking-widest uppercase mb-2 animate-kop-flicker">
            ✓ Inscrição Confirmada
          </div>
          <h1 className="font-arcade text-3xl text-red-500 mb-6 animate-kop-slam">READY TO FIGHT!</h1>
          <div className="flex justify-center mb-4">
            <PlayerCard player={confirmed} size="xl" testId="confirmed-card" />
          </div>
          <div className="font-display text-2xl text-white uppercase mt-2">{confirmed.name}</div>
          {confirmed.nickname && <div className="text-cyan-300 uppercase text-sm tracking-widest">"{confirmed.nickname}"</div>}
          <div className="mt-4 inline-block border border-green-500/60 text-green-400 px-3 py-1 font-display text-xs uppercase tracking-widest">
            STATUS: CONFIRMADO
          </div>
          <div className="mt-6 text-slate-500 text-sm">
            Aguarde o sorteio das equipes pelo organizador.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-6">
        <div className="font-display text-cyan-300 text-xs tracking-[0.4em] uppercase">Player Registration</div>
        <h1 className="font-arcade text-3xl sm:text-4xl text-red-500 uppercase">Inscrição KOP 3x3</h1>
      </div>
      <form onSubmit={submit} className="space-y-4 bg-black/60 border border-red-900/50 kop-chamfer p-5 sm:p-8">
        <div className="flex flex-col items-center gap-3">
          <div
            onClick={() => fileRef.current?.click()}
            data-testid="photo-upload-box"
            className="relative w-40 h-40 kop-chamfer border-2 border-dashed border-red-500/60 bg-slate-900 flex items-center justify-center cursor-pointer overflow-hidden hover:border-red-500"
          >
            {photo ? <img src={photo} alt="preview" className="w-full h-full object-cover" /> : (
              <div className="text-center text-slate-500">
                <Camera className="w-8 h-8 mx-auto mb-1" />
                <div className="text-xs font-display uppercase tracking-widest">Enviar Foto</div>
              </div>
            )}
          </div>
          <input ref={fileRef} data-testid="photo-input" type="file" accept="image/*" onChange={onFile} className="hidden" />
        </div>

        <div>
          <label className="text-xs font-display uppercase tracking-widest text-slate-400">Nome Completo *</label>
          <input data-testid="name-input" value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 bg-slate-900 border border-slate-700 focus:border-red-500 px-3 py-2 text-white outline-none" />
        </div>

        <div>
          <label className="text-xs font-display uppercase tracking-widest text-slate-400">Apelido</label>
          <input data-testid="nickname-input" value={nickname} onChange={e => setNickname(e.target.value)} className="w-full mt-1 bg-slate-900 border border-slate-700 focus:border-red-500 px-3 py-2 text-white outline-none" />
        </div>

        <div>
          <label className="text-xs font-display uppercase tracking-widest text-slate-400">Nível *</label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {LEVELS.map(l => (
              <button
                key={l}
                type="button"
                data-testid={`level-${l}`}
                onClick={() => setLevel(l)}
                className={`kop-chamfer border-2 px-2 py-2 font-display uppercase text-xs sm:text-sm tracking-widest transition ${level === l ? "border-red-500 bg-red-500/20 text-red-400" : "border-slate-700 text-slate-400 hover:border-slate-500"}`}
              >{l}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-display uppercase tracking-widest text-slate-400">WhatsApp (opcional)</label>
          <input data-testid="whatsapp-input" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="w-full mt-1 bg-slate-900 border border-slate-700 focus:border-red-500 px-3 py-2 text-white outline-none" />
        </div>
        <div>
          <label className="text-xs font-display uppercase tracking-widest text-slate-400">Observação (opcional)</label>
          <textarea data-testid="notes-input" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full mt-1 bg-slate-900 border border-slate-700 focus:border-red-500 px-3 py-2 text-white outline-none" />
        </div>

        <button
          type="submit"
          data-testid="submit-register-btn"
          disabled={submitting}
          className="w-full kop-chamfer bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-arcade uppercase tracking-widest py-3 kop-glow-red transition"
        >
          {submitting ? "Enviando..." : "▶ Confirmar Inscrição"}
        </button>
      </form>
    </div>
  );
}

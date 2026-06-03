"use client";

import { useEffect, useMemo, useState } from "react";
import type { LeadFull } from "../lead-modal";

// Slots de hora (07:00 → 21:00, 15 em 15 min) — igual ao lead-modal.
const TIME_SLOTS: string[] = (() => {
  const out: string[] = [];
  const pad = (n: number) => n.toString().padStart(2, "0");
  for (let h = 7; h <= 21; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === 21 && m > 0) break;
      out.push(`${pad(h)}:${pad(m)}`);
    }
  }
  return out;
})();

function splitLocal(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const pad = (n: number) => n.toString().padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function combineLocal(date: string, time: string): string | null {
  if (!date) return null;
  const d = new Date(`${date}T${time || "09:00"}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

type LeadLite = { id: string; name: string | null; phone: string };

export function AppointmentModal({
  lead,
  initialISO,
  onClose,
  onSaved,
}: {
  // lead definido = editar/remarcar. null = novo (busca lead).
  lead?: LeadLite | null;
  initialISO?: string | null;
  onClose: () => void;
  onSaved: (updated: LeadFull) => void;
}) {
  const isEdit = !!lead;
  const init = useMemo(() => splitLocal(initialISO ?? null), [initialISO]);
  const [picked, setPicked] = useState<LeadLite | null>(lead ?? null);
  const [date, setDate] = useState(init.date);
  const [time, setTime] = useState(init.time);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Busca de lead (modo novo)
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<LeadLite[]>([]);
  useEffect(() => {
    if (picked) return;
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/leads/search?q=${encodeURIComponent(term)}`);
        const data = await res.json();
        setHits(res.ok ? (data.leads ?? []) : []);
      } catch {
        setHits([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, picked]);

  async function patch(body: Record<string, unknown>) {
    if (!picked) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/leads/${picked.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "erro");
      onSaved(data.lead as LeadFull);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "erro");
    } finally {
      setSaving(false);
    }
  }

  function save() {
    if (!picked || !date) {
      setErr("Escolha o lead e a data.");
      return;
    }
    patch({ scheduled_at: combineLocal(date, time) });
  }

  function cancelAppointment() {
    if (!window.confirm("Cancelar esse agendamento? A call sai da agenda.")) return;
    patch({ scheduled_at: null });
  }

  const timeOpts =
    time && !TIME_SLOTS.includes(time) ? [time, ...TIME_SLOTS] : TIME_SLOTS;

  return (
    <div className="fixed inset-0 z-[60]">
      <div onClick={onClose} className="absolute inset-0 bg-black/50" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center">
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative bg-white rounded-t-2xl md:rounded-2xl md:max-w-md w-full md:shadow-2xl"
        >
          <div className="bg-[var(--sakura-cocoa,#3b2d28)] text-white px-4 py-3 flex items-center justify-between rounded-t-2xl">
            <h3 className="font-semibold text-sm">
              {isEdit ? "📆 Remarcar call" : "📆 Novo agendamento"}
            </h3>
            <button onClick={onClose} className="text-white/80 hover:text-white text-xl leading-none">
              ×
            </button>
          </div>

          <div className="p-4 space-y-4 pb-[max(env(safe-area-inset-bottom),16px)]">
            {err && (
              <p className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {err}
              </p>
            )}

            {/* Lead */}
            {picked ? (
              <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {picked.name ?? picked.phone}
                  </p>
                  <p className="text-[12px] text-slate-500 truncate">{picked.phone}</p>
                </div>
                {!isEdit && (
                  <button
                    onClick={() => setPicked(null)}
                    className="text-[12px] text-slate-500 hover:text-slate-900 shrink-0"
                  >
                    trocar
                  </button>
                )}
              </div>
            ) : (
              <div>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="🔍 Buscar lead por nome ou telefone"
                  className="w-full px-3 py-2.5 text-base bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-slate-900"
                />
                {hits.length > 0 && (
                  <ul className="mt-1 border border-slate-200 rounded-lg overflow-hidden max-h-52 overflow-y-auto">
                    {hits.map((h) => (
                      <li key={h.id}>
                        <button
                          onClick={() => {
                            setPicked(h);
                            setHits([]);
                            setQ("");
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-50"
                        >
                          <p className="text-[14px] font-semibold text-slate-900 truncate">
                            {h.name ?? h.phone}
                          </p>
                          <p className="text-[12px] text-slate-500 truncate">{h.phone}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Data + hora */}
            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 min-w-0 px-2.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none"
              />
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                aria-label="Hora"
                className="w-[104px] shrink-0 px-2.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none"
              >
                <option value="">hora…</option>
                {timeOpts.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={save}
              disabled={saving || !picked || !date}
              className="w-full py-2.5 text-sm font-semibold text-white bg-[var(--sakura-cocoa,#3b2d28)] rounded-lg disabled:opacity-40"
            >
              {saving ? "Salvando…" : isEdit ? "Salvar nova data" : "Agendar"}
            </button>

            {isEdit && (
              <button
                onClick={cancelAppointment}
                disabled={saving}
                className="w-full py-2 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-40"
              >
                Cancelar agendamento
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

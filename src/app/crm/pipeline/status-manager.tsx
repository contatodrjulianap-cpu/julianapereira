"use client";

import { useState } from "react";
import {
  STATUS_COLOR_PALETTE,
  STATUS_LABEL,
  STATUS_BADGE,
  STATUS_OPTIONS,
  type CustomStatus,
} from "@/lib/lead-status";

// Status de sistema mostrados como "fixos" (só leitura) pra contexto.
const SYSTEM_VISIBLE = STATUS_OPTIONS.filter((s) => STATUS_LABEL[s]);

export function StatusManagerModal({
  statuses,
  onClose,
  onChange,
}: {
  statuses: CustomStatus[];
  onClose: () => void;
  onChange: (next: CustomStatus[]) => void;
}) {
  const [items, setItems] = useState<CustomStatus[]>(statuses);
  const [newLabel, setNewLabel] = useState("");
  const [newBadge, setNewBadge] = useState(STATUS_COLOR_PALETTE[0].badge);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function sync(next: CustomStatus[]) {
    setItems(next);
    onChange(next);
  }

  async function add() {
    const label = newLabel.trim();
    if (!label) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/lead-statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, badge: newBadge }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "erro");
      sync([...items, data.status]);
      setNewLabel("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "erro");
    } finally {
      setBusy(false);
    }
  }

  async function patch(key: string, body: Partial<CustomStatus>) {
    setErr(null);
    try {
      const res = await fetch(`/api/lead-statuses/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "erro");
      sync(items.map((s) => (s.key === key ? data.status : s)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "erro");
    }
  }

  async function remove(key: string, label: string) {
    if (!window.confirm(`Remover o status "${label}"?`)) return;
    setErr(null);
    try {
      const res = await fetch(`/api/lead-statuses/${key}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "erro");
      sync(items.filter((s) => s.key !== key));
      if (data.deactivated) {
        setErr(
          `Status guardado (${data.leads} lead(s) ainda usam) — sumiu das colunas.`,
        );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "erro");
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div onClick={onClose} className="absolute inset-0 bg-black/50" aria-hidden />
      <div className="absolute inset-0 overflow-y-auto">
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative bg-white md:rounded-2xl max-w-lg w-full md:mx-auto md:my-10 shadow-2xl min-h-screen md:min-h-0"
        >
          <div className="sticky top-0 bg-[var(--sakura-cocoa,#3b2d28)] text-white px-4 py-3 flex items-center justify-between md:rounded-t-2xl">
            <h3 className="font-semibold text-sm">⚙️ Gerenciar status</h3>
            <button onClick={onClose} className="text-white/80 hover:text-white text-xl leading-none">
              ×
            </button>
          </div>

          <div className="p-4 space-y-5">
            {err && (
              <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {err}
              </p>
            )}

            {/* Criar novo */}
            <section>
              <h4 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2">
                Criar status
              </h4>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        add();
                      }
                    }}
                    placeholder="Nome do status (ex: Aguardando documento)"
                    maxLength={40}
                    className="flex-1 min-w-0 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  />
                  <button
                    onClick={add}
                    disabled={busy || !newLabel.trim()}
                    className="px-3 py-2 text-sm font-semibold text-white bg-[var(--sakura-cocoa,#3b2d28)] rounded-lg disabled:opacity-40"
                  >
                    + Criar
                  </button>
                </div>
                <ColorPicker value={newBadge} onChange={setNewBadge} />
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Prévia:</span>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${newBadge}`}>
                    {newLabel.trim() || "Novo status"}
                  </span>
                </div>
              </div>
            </section>

            {/* Custom existentes */}
            <section>
              <h4 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2">
                Seus status ({items.length})
              </h4>
              {items.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">
                  Nenhum status custom ainda. Crie acima.
                </p>
              ) : (
                <ul className="space-y-3">
                  {items.map((s) => (
                    <li key={s.key} className="border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          defaultValue={s.label}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== s.label) patch(s.key, { label: v });
                          }}
                          maxLength={40}
                          className="flex-1 min-w-0 px-2.5 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none"
                        />
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${s.badge}`}>
                          {s.label}
                        </span>
                        <button
                          onClick={() => remove(s.key, s.label)}
                          className="shrink-0 text-slate-400 hover:text-red-600 px-1"
                          title="Remover"
                        >
                          🗑
                        </button>
                      </div>
                      <ColorPicker
                        value={s.badge}
                        onChange={(badge) => patch(s.key, { badge })}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Sistema (read-only) */}
            <section>
              <h4 className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2">
                Status de sistema (fixos)
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {SYSTEM_VISIBLE.map((s) => (
                  <span
                    key={s}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE[s] ?? "bg-slate-100 text-slate-700"}`}
                  >
                    {STATUS_LABEL[s]}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">
                Protegidos — têm lógica de funil/receita. Não dá pra editar/remover.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (badge: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {STATUS_COLOR_PALETTE.map((c) => {
        const selected = c.badge === value;
        return (
          <button
            key={c.name}
            type="button"
            onClick={() => onChange(c.badge)}
            title={c.name}
            className={`w-7 h-7 rounded-full ${c.badge} flex items-center justify-center text-[10px] ring-2 ${
              selected ? "ring-slate-900" : "ring-transparent"
            }`}
          >
            {selected ? "✓" : ""}
          </button>
        );
      })}
    </div>
  );
}

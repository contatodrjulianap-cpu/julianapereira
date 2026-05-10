"use client";

import { useState } from "react";
import { QUESTIONS, type Archetype } from "@/lib/quiz-archetypes";

export type LeadFull = {
  id: string;
  name: string | null;
  phone: string;
  instagram: string | null;
  source: string | null;
  archetype: "PRONTA" | "ESPERANCOSA" | "CETICA" | null;
  geo: "SP" | "BR" | "INTL" | null;
  case_type: string | null;
  status: string | null;
  tags: string[];
  notes: string | null;
  notes_log: NoteEntry[] | null;
  assigned_to: string | null;
  next_contact_at: string | null;
  deal_value: number | null;
  quiz_answers: Record<string, string> | null;
  archetype_scores: Record<Archetype, number> | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NoteEntry = { at: string; by: string; text: string };

export const ARCH_LABEL: Record<NonNullable<LeadFull["archetype"]>, string> = {
  PRONTA: "🔥 Pronta",
  ESPERANCOSA: "🟡 Esperançosa",
  CETICA: "📍 Cética",
};

export const ARCH_BADGE: Record<NonNullable<LeadFull["archetype"]>, string> = {
  PRONTA: "bg-green-100 text-green-800",
  ESPERANCOSA: "bg-amber-100 text-amber-800",
  CETICA: "bg-slate-200 text-slate-700",
};

export const STATUS_LABEL: Record<string, string> = {
  new: "📨 Novo",
  contacted: "📞 Contatado",
  qualified: "✅ Qualificado",
  proposal: "💰 Proposta",
  won: "🎉 Fechado",
  lost: "❌ Perdido",
};

export const STATUS_BADGE: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-indigo-100 text-indigo-800",
  qualified: "bg-amber-100 text-amber-800",
  proposal: "bg-pink-100 text-pink-800",
  won: "bg-emerald-100 text-emerald-800",
  lost: "bg-red-100 text-red-800",
};

export const STATUS_OPTIONS = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "won",
  "lost",
];

export function LeadModal({
  lead,
  onClose,
  onSaved,
}: {
  lead: LeadFull;
  onClose: () => void;
  onSaved: (updated: LeadFull) => void;
}) {
  const [form, setForm] = useState({
    status: lead.status ?? "new",
    assigned_to: lead.assigned_to ?? "",
    next_contact_at: lead.next_contact_at ?? "",
    deal_value: lead.deal_value?.toString() ?? "",
  });
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notes = lead.notes_log ?? [];

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: form.status,
          assigned_to: form.assigned_to.trim() || null,
          next_contact_at: form.next_contact_at || null,
          deal_value: form.deal_value === "" ? null : Number(form.deal_value),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      onSaved(data.lead as LeadFull);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    if (!noteText.trim()) return;
    setError(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: noteText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar nota");
      onSaved(data.lead as LeadFull);
      setNoteText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-10 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-2xl w-full p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">{lead.name ?? "(sem nome)"}</h3>
            <p className="text-sm text-slate-500">
              {lead.phone}
              {lead.instagram && ` · ${lead.instagram}`}
              {lead.archetype && ` · ${ARCH_LABEL[lead.archetype]}`}
              {lead.geo && ` · ${lead.geo}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Responsável">
            <input
              value={form.assigned_to}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
              placeholder="ex: Lucas, Bárbara"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </Field>
          <Field label="Próximo contato">
            <input
              type="date"
              value={form.next_contact_at}
              onChange={(e) =>
                setForm({ ...form, next_contact_at: e.target.value })
              }
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </Field>
          <Field label="Valor da venda (R$)">
            <input
              type="number"
              value={form.deal_value}
              onChange={(e) => setForm({ ...form, deal_value: e.target.value })}
              placeholder="ex: 25000"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </Field>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Adicionar nota
          </label>
          <div className="flex gap-2">
            <input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addNote();
                }
              }}
              placeholder="ex: Conversou e ficou de retornar até sexta"
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
            <button
              onClick={addNote}
              disabled={!noteText.trim()}
              className="px-3 py-2 text-sm rounded-md bg-slate-900 text-white disabled:opacity-40"
            >
              Adicionar
            </button>
          </div>
        </div>

        {notes.length > 0 && (
          <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
            {[...notes].reverse().map((n, i) => (
              <div
                key={i}
                className="bg-slate-50 border-l-2 border-emerald-500 px-3 py-2 rounded text-sm"
              >
                <p className="text-[11px] text-slate-400 mb-1">
                  {new Date(n.at).toLocaleString("pt-BR")} · {n.by}
                </p>
                <p>{n.text}</p>
              </div>
            ))}
          </div>
        )}

        {lead.quiz_answers && Object.keys(lead.quiz_answers).length > 0 && (
          <details className="mb-4 text-sm" open>
            <summary className="cursor-pointer font-semibold text-slate-600">
              Respostas do quiz ({Object.keys(lead.quiz_answers).length}/8)
            </summary>
            <div className="mt-3 space-y-2.5 border border-slate-100 rounded-md p-3 bg-slate-50/60">
              {QUESTIONS.map((q) => {
                const ans = lead.quiz_answers?.[q.key];
                if (!ans) return null;
                const opt = q.options.find((o) => o.value === ans);
                return (
                  <div key={q.key} className="text-[13px] leading-snug">
                    <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">
                      Q{q.num} · {q.title}
                    </p>
                    <p className="text-slate-800 mt-0.5">
                      {opt?.emoji && <span className="mr-1">{opt.emoji}</span>}
                      {opt?.label ?? ans}
                    </p>
                  </div>
                );
              })}
              {lead.archetype_scores && (
                <div className="pt-2 border-t border-slate-200 flex gap-3 text-[11px] text-slate-500">
                  <span>
                    🔥 Pronta:{" "}
                    <strong className="text-slate-700">
                      {lead.archetype_scores.PRONTA ?? 0}
                    </strong>
                  </span>
                  <span>
                    🟡 Esperançosa:{" "}
                    <strong className="text-slate-700">
                      {lead.archetype_scores.ESPERANCOSA ?? 0}
                    </strong>
                  </span>
                  <span>
                    📍 Cética:{" "}
                    <strong className="text-slate-700">
                      {lead.archetype_scores.CETICA ?? 0}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          </details>
        )}

        {(lead.utm_source ||
          lead.utm_medium ||
          lead.utm_campaign ||
          lead.utm_term ||
          lead.utm_content) && (
          <div className="mb-4 bg-slate-50 border border-slate-200 rounded-md p-3">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-2">
              🔗 Atribuição (UTM)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1.5 text-[12px]">
              {lead.utm_source && (
                <div>
                  <span className="text-slate-400 font-mono text-[10px]">source</span>
                  <p className="text-slate-800 font-medium truncate">
                    {lead.utm_source}
                  </p>
                </div>
              )}
              {lead.utm_medium && (
                <div>
                  <span className="text-slate-400 font-mono text-[10px]">medium</span>
                  <p className="text-slate-800 font-medium truncate">
                    {lead.utm_medium}
                  </p>
                </div>
              )}
              {lead.utm_campaign && (
                <div>
                  <span className="text-slate-400 font-mono text-[10px]">campaign</span>
                  <p className="text-slate-800 font-medium truncate">
                    {lead.utm_campaign}
                  </p>
                </div>
              )}
              {lead.utm_term && (
                <div>
                  <span className="text-slate-400 font-mono text-[10px]">term</span>
                  <p className="text-slate-800 font-medium truncate">
                    {lead.utm_term}
                  </p>
                </div>
              )}
              {lead.utm_content && (
                <div>
                  <span className="text-slate-400 font-mono text-[10px]">content</span>
                  <p className="text-slate-800 font-medium truncate">
                    {lead.utm_content}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {lead.tags?.length > 0 && (
          <details className="mb-4 text-sm">
            <summary className="cursor-pointer font-semibold text-slate-600">
              Tags ({lead.tags.length})
            </summary>
            <div className="flex flex-wrap gap-1 mt-2">
              {lead.tags.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] rounded"
                >
                  {t}
                </span>
              ))}
            </div>
          </details>
        )}

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <div className="flex justify-between items-center">
          <a
            href={whatsLink(lead.phone, lead.name)}
            target="_blank"
            rel="noreferrer noopener"
            className="px-3 py-2 text-sm rounded-md bg-emerald-500 text-white hover:bg-emerald-600"
          >
            💬 WhatsApp
          </a>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 text-sm rounded-md border border-slate-200 hover:border-slate-400"
            >
              Fechar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-2 text-sm rounded-md bg-slate-900 text-white disabled:opacity-40"
            >
              {saving ? "Salvando..." : "💾 Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export function whatsLink(phone: string, name: string | null): string {
  const digits = phone.replace(/\D/g, "");
  const final = digits.startsWith("55") ? digits : `55${digits}`;
  const firstName = name?.split(" ")[0] ?? "";
  const msg = encodeURIComponent(
    `Oi${firstName ? " " + firstName : ""}! Aqui é da equipe da Dra. Juliana Pereira 🌸`,
  );
  return `https://wa.me/${final}?text=${msg}`;
}

export function fmtBRL(n: number): string {
  return (
    "R$ " +
    n.toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}

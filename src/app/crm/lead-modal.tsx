"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
  assigned_to: string | null;        // legacy: campo livre (Lucas/Bárbara/etc)
  assigned_owner_id: string | null;  // novo: auth.users.id atribuído via rotação
  wa_number_id: string | null;       // qual número WPP recebeu/atende o lead
  next_contact_at: string | null;
  deal_value: number | null;
  quiz_answers: Record<string, string | string[]> | null;
  selfie_url: string | null;
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

type HistoryItem = {
  id: string;
  ts: string;
  kind: "event" | "msg_in" | "msg_out";
  type: string;
  label: string;
  detail?: string;
  status?: string;
  emoji: string;
};

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

  // ---- Histórico (events + messages) ----
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    (async () => {
      setLoadingHistory(true);
      const [eventsRes, msgsRes] = await Promise.all([
        supabase
          .from("event_log")
          .select("id, type, status, target, error, payload, created_at")
          .eq("lead_id", lead.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("messages")
          .select("id, direction, text, created_at")
          .eq("lead_id", lead.id)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (!active) return;

      const items: HistoryItem[] = [];

      for (const e of eventsRes.data ?? []) {
        const meta = describeEvent(e.type, e.status as string);
        items.push({
          id: `e-${e.id}`,
          ts: e.created_at,
          kind: "event",
          type: e.type,
          label: meta.label,
          emoji: meta.emoji,
          status: e.status as string,
          detail: buildEventDetail(e.type, e.payload, e.error, e.target),
        });
      }

      for (const m of msgsRes.data ?? []) {
        const isOut = m.direction === "outbound";
        items.push({
          id: `m-${m.id}`,
          ts: m.created_at,
          kind: isOut ? "msg_out" : "msg_in",
          type: isOut ? "WhatsApp enviado" : "WhatsApp recebido",
          label: isOut ? "Mensagem enviada" : "Mensagem recebida",
          emoji: isOut ? "➡️" : "⬅️",
          detail: m.text,
        });
      }

      items.sort((a, b) => (a.ts < b.ts ? 1 : -1));
      setHistory(items);
      setLoadingHistory(false);
    })();
    return () => {
      active = false;
    };
  }, [lead.id]);

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
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {lead.selfie_url && <SelfieThumb leadId={lead.id} />}
            <div className="min-w-0">
              <h3 className="text-lg font-bold">{lead.name ?? "(sem nome)"}</h3>
              <p className="text-sm text-slate-500">
                {lead.phone}
                {lead.instagram && ` · ${lead.instagram}`}
                {lead.archetype && ` · ${ARCH_LABEL[lead.archetype]}`}
                {lead.geo && ` · ${lead.geo}`}
              </p>
            </div>
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
                const selected = Array.isArray(ans) ? ans : [ans];
                const opts = selected
                  .map((v) => q.options.find((o) => o.value === v))
                  .filter(Boolean) as { emoji?: string; label: string }[];
                return (
                  <div key={q.key} className="text-[13px] leading-snug">
                    <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">
                      Q{q.num} · {q.title}
                    </p>
                    {opts.length > 0 ? (
                      opts.map((opt, i) => (
                        <p key={i} className="text-slate-800 mt-0.5">
                          {opt.emoji && <span className="mr-1">{opt.emoji}</span>}
                          {opt.label}
                        </p>
                      ))
                    ) : (
                      <p className="text-slate-800 mt-0.5">{selected.join(", ")}</p>
                    )}
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

        {/* Histórico (timeline de eventos + mensagens) */}
        <details className="mb-4 text-sm" open>
          <summary className="cursor-pointer font-semibold text-slate-600">
            🕐 Histórico ({loadingHistory ? "..." : history.length} itens)
          </summary>
          <div className="mt-3 max-h-72 overflow-y-auto border border-slate-100 rounded-md bg-slate-50/40">
            {loadingHistory ? (
              <p className="p-3 text-xs text-slate-400 italic">Carregando...</p>
            ) : history.length === 0 ? (
              <p className="p-3 text-xs text-slate-400 italic">
                Sem eventos ainda.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {history.map((h) => (
                  <li
                    key={h.id}
                    className={`px-3 py-2 flex items-start gap-2 ${
                      h.kind === "msg_out"
                        ? "bg-emerald-50/40"
                        : h.kind === "msg_in"
                          ? "bg-blue-50/40"
                          : ""
                    }`}
                  >
                    <span className="text-base leading-tight pt-0.5">{h.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-medium text-slate-800">
                          {h.label}
                          {h.status === "failed" && (
                            <span className="ml-1.5 text-[10px] text-red-700 bg-red-100 px-1 rounded">
                              falhou
                            </span>
                          )}
                        </p>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap font-mono">
                          {fmtTimelineTime(h.ts)}
                        </span>
                      </div>
                      {h.detail && (
                        <p className="text-[11px] text-slate-600 mt-0.5 break-words">
                          {h.detail}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>

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

function SelfieThumb({ leadId }: { leadId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/leads/${leadId}/selfie`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { url?: string } | null) => {
        if (alive && j?.url) setUrl(j.url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [leadId]);

  if (!url) {
    return (
      <div className="w-14 h-14 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-300 text-xs">
        ...
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-14 h-14 rounded-md overflow-hidden border border-slate-200 shrink-0 hover:opacity-80 transition"
        aria-label="Ver foto do sorriso"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Sorriso" className="w-full h-full object-cover" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-6"
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Sorriso (ampliado)"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </>
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

// =================================================
// Helpers de histórico
// =================================================

function describeEvent(
  type: string,
  status: string,
): { emoji: string; label: string } {
  const map: Record<string, { emoji: string; label: string }> = {
    quiz_submit: { emoji: "📝", label: "Quiz finalizado" },
    quiz_pageview: { emoji: "👁", label: "Abriu a página do quiz" },
    quiz_step_view: { emoji: "📍", label: "Avançou etapa do quiz" },
    quiz_wa_click: { emoji: "💬", label: "Clicou no WhatsApp" },
    quiz_instagram_click: { emoji: "📷", label: "Clicou no Instagram" },
    fb_capi: { emoji: "📘", label: "Evento Facebook (CAPI)" },
    zapi_send_text: { emoji: "📤", label: "Z-API: mensagem enviada" },
    zapi_webhook: { emoji: "📥", label: "Z-API: webhook recebido" },
    lead_update: { emoji: "✏️", label: "Lead atualizado" },
    lead_note: { emoji: "📌", label: "Nota adicionada" },
    integration_config_update: { emoji: "🔌", label: "Config integrações alterada" },
    quiz_config_update: { emoji: "🛠️", label: "Config do quiz alterada" },
  };
  const base = map[type] ?? { emoji: "•", label: type };
  if (status === "failed") return { ...base, emoji: "⚠️" };
  if (status === "skipped") return { ...base, emoji: "⏭" };
  return base;
}

function buildEventDetail(
  type: string,
  payload: Record<string, unknown> | null,
  error: string | null,
  target: string | null,
): string | undefined {
  if (error) return `erro: ${error}`;
  if (!payload) return target ? `→ ${target}` : undefined;

  if (type === "fb_capi") {
    const evt = payload.event_name as string | undefined;
    return evt ? `evento: ${evt}` : undefined;
  }
  if (type === "quiz_submit") {
    const arch = payload.archetype as string | undefined;
    const geo = payload.geo as string | undefined;
    if (arch && geo) return `${arch} · ${geo}`;
  }
  if (type === "quiz_step_view") {
    const step = payload.step as string | undefined;
    return step ? `step: ${step}` : undefined;
  }
  if (type === "lead_update") {
    const status = payload.status as string | undefined;
    return status ? `status → ${status}` : undefined;
  }
  return target ?? undefined;
}

function fmtTimelineTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (isToday) return `Hoje · ${time}`;
  return (
    d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }) + ` · ${time}`
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

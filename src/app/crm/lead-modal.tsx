"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { QUESTIONS, type Archetype } from "@/lib/quiz-archetypes";
import { SourceBadge } from "./conversas/source-icons";

export type LeadFull = {
  id: string;
  name: string | null;
  phone: string;
  instagram: string | null;
  source: string | null;
  quiz_variant: "resina" | "porcelana" | null;
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
  selfie_signed_url?: string | null;
  pinned: boolean;
  follow_up_at: string | null;
  follow_up_note: string | null;
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
  proposal: "⏰ Follow up",
  won: "🎉 Fechado",
  lost: "❌ Perdido",
  disqualified: "🚫 Desqualificado",
};

export const STATUS_BADGE: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-indigo-100 text-indigo-800",
  qualified: "bg-amber-100 text-amber-800",
  proposal: "bg-pink-100 text-pink-800",
  won: "bg-emerald-100 text-emerald-800",
  lost: "bg-red-100 text-red-800",
  disqualified: "bg-zinc-200 text-zinc-700",
};

export const STATUS_OPTIONS = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "won",
  "lost",
  "disqualified",
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

type MediaMsg = {
  id: string;
  direction: "inbound" | "outbound";
  caption: string | null;
  media_type: string;
  created_at: string;
};

function detectSourceKey(src: string | null | undefined): string {
  const s = (src ?? "").toLowerCase();
  if (s.includes("insta")) return "instagram";
  if (s.includes("google")) return "google";
  if (s.includes("tiktok")) return "tiktok";
  if (s.includes("quiz")) return "quiz";
  if (s.includes("indica")) return "indicacao";
  if (s.includes("organ") || s.includes("seo")) return "organico";
  if (s.includes("whats")) return "whatsapp";
  return src ?? "";
}

// Origem legível textual pra header do modal — combina source+variant
// igual o badge da coluna Origem do pipeline.
function originLabel(
  source: string | null | undefined,
  quizVariant: string | null | undefined,
): string | null {
  const s = (source ?? "").toLowerCase();
  if (s === "quiz") {
    if (quizVariant === "resina") return "Quiz · Resina";
    if (quizVariant === "porcelana") return "Quiz · Porcelana";
    return "Quiz";
  }
  if (s === "kiwify" || s.startsWith("kiwify")) return "Kiwify";
  if (s === "vlr-pagina-venda" || s.startsWith("lp-") || s.startsWith("vlr-")) {
    return "Página de vendas";
  }
  if (!source) return null;
  return source;
}

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
    assigned_owner_id: lead.assigned_owner_id ?? "",
    follow_up_date: lead.follow_up_at
      ? new Date(lead.follow_up_at).toISOString().slice(0, 10)
      : "",
    follow_up_note: lead.follow_up_note ?? "",
    deal_value: lead.deal_value?.toString() ?? "",
    source: detectSourceKey(lead.source),
  });
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crmUsers, setCrmUsers] = useState<
    Array<{ id: string; display_name: string; role: string }>
  >([]);

  const notes = lead.notes_log ?? [];

  // ---- Histórico (events + messages) ----
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [mediaMessages, setMediaMessages] = useState<MediaMsg[]>([]);

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
          .select("id, direction, text, media_url, media_type, created_at")
          .eq("lead_id", lead.id)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (!active) return;

      // Mídia: filtra mensagens que têm anexo
      const mediaList: MediaMsg[] = (msgsRes.data ?? [])
        .filter(
          (m): m is { id: string; direction: string; text: string | null; media_url: string; media_type: string; created_at: string } =>
            !!m.media_url && !!m.media_type,
        )
        .map((m) => ({
          id: m.id,
          direction: m.direction as "inbound" | "outbound",
          caption: m.text,
          media_type: m.media_type,
          created_at: m.created_at,
        }));
      setMediaMessages(mediaList);

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

      const { data: users } = await supabase
        .from("crm_users")
        .select("id, display_name, role")
        .order("display_name");
      if (active && users) setCrmUsers(users);
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
          assigned_owner_id: form.assigned_owner_id || null,
          follow_up_at: form.follow_up_date
            ? new Date(`${form.follow_up_date}T12:00:00`).toISOString()
            : null,
          follow_up_note: form.follow_up_note.trim() || null,
          deal_value: form.deal_value === "" ? null : Number(form.deal_value),
          source: form.source || null,
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

  const hasUtm = !!(
    lead.utm_source ||
    lead.utm_medium ||
    lead.utm_campaign ||
    lead.utm_term ||
    lead.utm_content
  );
  const hasQuiz =
    lead.quiz_answers && Object.keys(lead.quiz_answers).length > 0;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop (click fecha) */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
        aria-hidden
      />
      {/* Wrapper scrollavel — único scroll, ocupa tela toda no mobile */}
      <div className="absolute inset-0 overflow-y-auto overscroll-contain">
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative bg-[#f0f2f5] md:rounded-2xl max-w-2xl w-full md:mx-auto md:my-10 shadow-2xl flex flex-col pb-[max(env(safe-area-inset-bottom),24px)] min-h-screen md:min-h-0"
        >
        {/* Top bar */}
        <div className="bg-[var(--sakura-cocoa,#3b2d28)] text-white px-3 py-3 flex items-center gap-3 shrink-0">
          <button
            onClick={onClose}
            className="text-white p-1 active:opacity-60"
            aria-label="Fechar"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <p className="font-semibold text-sm flex-1">Info do contato</p>
        </div>

        {/* Hero — avatar grande + nome + badges + action buttons */}
        <div className="bg-white px-6 pt-8 pb-6 text-center">
          <SelfieLargeAvatar leadId={lead.id} hasSelfie={!!lead.selfie_url} name={lead.name} />
          <h2 className="text-[22px] font-semibold text-slate-900 mt-3 leading-tight">
            {lead.name ?? "(sem nome)"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{lead.phone}</p>
          {originLabel(lead.source, lead.quiz_variant) && (
            <p className="text-xs text-slate-600 mt-1 font-medium">
              {originLabel(lead.source, lead.quiz_variant)}
            </p>
          )}
          {lead.instagram && (
            <a
              href={`https://instagram.com/${lead.instagram.replace(/^@/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-rose-500 mt-0.5 inline-block hover:underline"
            >
              {lead.instagram.startsWith("@")
                ? lead.instagram
                : `@${lead.instagram}`}
            </a>
          )}

          <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap">
            <SourceBadge source={lead.source} />
            {lead.archetype && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ARCH_BADGE[lead.archetype]}`}
              >
                {ARCH_LABEL[lead.archetype]}
              </span>
            )}
            {lead.status && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE[lead.status] ?? "bg-slate-100 text-slate-700"}`}
              >
                {STATUS_LABEL[lead.status] ?? lead.status}
              </span>
            )}
            {form.assigned_owner_id && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                👤{" "}
                {crmUsers.find((u) => u.id === form.assigned_owner_id)
                  ?.display_name ?? "—"}
              </span>
            )}
          </div>

          <div className="flex items-center justify-center gap-5 mt-6">
            <CircleAction
              href={whatsLink(lead.phone, lead.name)}
              icon="💬"
              label="WhatsApp"
            />
            <CircleAction
              onClick={() =>
                navigator.clipboard?.writeText(lead.phone).catch(() => {})
              }
              icon="📋"
              label="Copiar"
            />
            {lead.instagram && (
              <CircleAction
                href={`https://instagram.com/${lead.instagram.replace(/^@/, "")}`}
                icon="📷"
                label="Instagram"
              />
            )}
          </div>
        </div>

        {/* Cards */}
        <div className="flex-1 px-3 py-3 space-y-3">
          {/* Status do funil */}
          <Card title="Status do funil">
            <div className="space-y-3">
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-2.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Origem (canal)">
                <select
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  className="w-full px-2.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none"
                >
                  <option value="">— Não definida</option>
                  <option value="whatsapp">💬 WhatsApp direto</option>
                  <option value="instagram">📷 Instagram</option>
                  <option value="google">🔎 Google</option>
                  <option value="tiktok">🎵 TikTok</option>
                  <option value="quiz">❓ Quiz</option>
                  <option value="indicacao">🤝 Indicação</option>
                  <option value="organico">🌐 Orgânico / SEO</option>
                </select>
              </Field>
              <Field label="Responsável">
                <select
                  value={form.assigned_owner_id}
                  onChange={(e) =>
                    setForm({ ...form, assigned_owner_id: e.target.value })
                  }
                  className="w-full px-2.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none"
                >
                  <option value="">— Sem responsável</option>
                  {crmUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.display_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Próximo contato">
                <input
                  type="date"
                  value={form.follow_up_date}
                  onChange={(e) =>
                    setForm({ ...form, follow_up_date: e.target.value })
                  }
                  className="w-full px-2.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none"
                />
              </Field>
              <Field label="Tarefa do follow-up (o que falar/fazer)">
                <textarea
                  value={form.follow_up_note}
                  onChange={(e) =>
                    setForm({ ...form, follow_up_note: e.target.value })
                  }
                  placeholder="Ex: mandar foto antes/depois da Cintia, confirmar agenda..."
                  rows={2}
                  maxLength={2000}
                  className="w-full px-2.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none resize-none"
                />
              </Field>
              <Field label="Valor da venda (R$)">
                <input
                  type="number"
                  value={form.deal_value}
                  onChange={(e) =>
                    setForm({ ...form, deal_value: e.target.value })
                  }
                  placeholder="—"
                  className="w-full px-2.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none"
                />
              </Field>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-3 w-full py-2 text-sm font-semibold text-white bg-[var(--sakura-cocoa,#3b2d28)] rounded-lg disabled:opacity-40 active:opacity-80"
            >
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </Card>

          {/* Mídia trocada */}
          {mediaMessages.length > 0 && (
            <Card title={`📸 Mídia, fotos e docs · ${mediaMessages.length}`}>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {mediaMessages
                  .filter((m) => m.media_type === "image")
                  .map((m) => (
                    <MediaThumb key={m.id} msgId={m.id} caption={m.caption} />
                  ))}
              </div>
              {mediaMessages.some((m) => m.media_type !== "image") && (
                <ul className="mt-3 space-y-1.5">
                  {mediaMessages
                    .filter((m) => m.media_type !== "image")
                    .map((m) => (
                      <MediaDoc
                        key={m.id}
                        msgId={m.id}
                        caption={m.caption ?? "Documento"}
                        direction={m.direction}
                      />
                    ))}
                </ul>
              )}
            </Card>
          )}

          {/* Notas */}
          <Card title="📝 Notas">
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
                className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none"
              />
              <button
                onClick={addNote}
                disabled={!noteText.trim()}
                className="px-3 py-2 text-sm rounded-lg bg-[var(--sakura-cocoa,#3b2d28)] text-white disabled:opacity-40"
              >
                +
              </button>
            </div>
            {notes.length > 0 && (
              <ul className="mt-3 space-y-2">
                {[...notes].reverse().slice(0, 20).map((n, i) => (
                  <li
                    key={i}
                    className="bg-slate-50 border-l-2 border-emerald-500 px-3 py-2 rounded text-sm"
                  >
                    <p className="text-[11px] text-slate-400 mb-0.5">
                      {new Date(n.at).toLocaleString("pt-BR")} · {n.by}
                    </p>
                    <p>{n.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Quiz */}
          {hasQuiz && (
            <Card title={`📝 Quiz · ${Object.keys(lead.quiz_answers ?? {}).length} respostas`}>
              <div className="space-y-2.5">
                {QUESTIONS.map((q) => {
                  const ans = lead.quiz_answers?.[q.key];
                  if (!ans) return null;
                  const selected = Array.isArray(ans) ? ans : [ans];
                  const opts = selected
                    .map((v) => q.options.find((o) => o.value === v))
                    .filter(Boolean) as { emoji?: string; label: string }[];
                  return (
                    <div key={q.key} className="text-[13px] leading-snug">
                      <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">
                        Q{q.num} · {q.title}
                      </p>
                      {opts.length > 0 ? (
                        opts.map((opt, i) => (
                          <p key={i} className="text-slate-800 mt-0.5">
                            {opt.emoji && (
                              <span className="mr-1">{opt.emoji}</span>
                            )}
                            {opt.label}
                          </p>
                        ))
                      ) : (
                        <p className="text-slate-800 mt-0.5">
                          {selected.join(", ")}
                        </p>
                      )}
                    </div>
                  );
                })}
                {lead.archetype_scores && (
                  <div className="pt-2 mt-2 border-t border-slate-100 flex gap-3 text-[11px] text-slate-500">
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
            </Card>
          )}

          {/* Histórico */}
          <Card title={`📅 Histórico · ${loadingHistory ? "..." : history.length}`}>
            {loadingHistory ? (
              <p className="text-xs text-slate-400 italic">Carregando...</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                Sem eventos ainda.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 -mx-4">
                {history.slice(0, 30).map((h) => (
                  <li
                    key={h.id}
                    className={`px-4 py-2 flex items-start gap-2 ${
                      h.kind === "msg_out"
                        ? "bg-emerald-50/40"
                        : h.kind === "msg_in"
                          ? "bg-blue-50/40"
                          : ""
                    }`}
                  >
                    <span className="text-base leading-tight pt-0.5">
                      {h.emoji}
                    </span>
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
          </Card>

          {/* UTM */}
          {hasUtm && (
            <Card title="🔗 Atribuição (UTM)">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
                {lead.utm_source && (
                  <UtmField label="source" value={lead.utm_source} />
                )}
                {lead.utm_medium && (
                  <UtmField label="medium" value={lead.utm_medium} />
                )}
                {lead.utm_campaign && (
                  <UtmField label="campaign" value={lead.utm_campaign} />
                )}
                {lead.utm_term && <UtmField label="term" value={lead.utm_term} />}
                {lead.utm_content && (
                  <UtmField label="content" value={lead.utm_content} />
                )}
              </div>
            </Card>
          )}

          {/* Tags editáveis */}
          <Card title={`🏷️ Tags · ${lead.tags?.length ?? 0}`}>
            <TagsEditor
              leadId={lead.id}
              tags={lead.tags ?? []}
              onChange={(next) => onSaved({ ...lead, tags: next })}
            />
          </Card>

          {error && <p className="text-xs text-red-600 px-2">{error}</p>}
        </div>
      </div>
      </div>
    </div>
  );
}

function SelfieLargeAvatar({
  leadId,
  hasSelfie,
  name,
}: {
  leadId: string;
  hasSelfie: boolean;
  name: string | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!hasSelfie) return;
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
  }, [leadId, hasSelfie]);

  const initial = (name ?? "?").trim()[0]?.toUpperCase() ?? "?";

  if (!url) {
    return (
      <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-3xl font-semibold mx-auto">
        {initial}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md mx-auto block active:opacity-80"
        aria-label="Ver foto ampliada"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="w-full h-full object-cover" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-6"
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </>
  );
}

function CircleAction({
  icon,
  label,
  href,
  onClick,
}: {
  icon: string;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const button = (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 active:opacity-60"
    >
      <span className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-xl">
        {icon}
      </span>
      <span className="text-[10px] font-semibold text-slate-600">{label}</span>
    </button>
  );
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center gap-1 active:opacity-60"
      >
        <span className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-xl">
          {icon}
        </span>
        <span className="text-[10px] font-semibold text-slate-600">{label}</span>
      </a>
    );
  }
  return button;
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl p-4">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
        {title}
      </h4>
      {children}
    </section>
  );
}

function UtmField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-slate-400 font-mono text-[10px]">{label}</span>
      <p className="text-slate-800 font-medium truncate text-[13px]">{value}</p>
    </div>
  );
}

function TagsEditor({
  leadId,
  tags,
  onChange,
}: {
  leadId: string;
  tags: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  async function persist(next: string[]) {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "erro");
      onChange((data.lead?.tags as string[]) ?? next);
    } catch (e) {
      alert(e instanceof Error ? e.message : "erro");
    } finally {
      setSaving(false);
    }
  }

  function addTag() {
    const t = draft.trim().replace(/^#/, "");
    if (!t) return;
    if (tags.includes(t)) {
      setDraft("");
      return;
    }
    const next = [...tags, t];
    setDraft("");
    void persist(next);
  }

  function removeTag(t: string) {
    void persist(tags.filter((x) => x !== t));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.length === 0 ? (
          <span className="text-xs text-slate-400 italic">Sem tags ainda.</span>
        ) : (
          tags.map((t) => (
            <button
              key={t}
              onClick={() => removeTag(t)}
              disabled={saving}
              className="group inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 text-[11px] rounded-full active:opacity-60"
              title="Clique pra remover"
            >
              <span>{t}</span>
              <span className="text-slate-400 group-hover:text-red-500">×</span>
            </button>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder="Nova tag..."
          maxLength={40}
          className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none"
        />
        <button
          onClick={addTag}
          disabled={saving || !draft.trim()}
          className="px-3 py-2 text-sm rounded-lg bg-[var(--sakura-cocoa,#3b2d28)] text-white disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

function MediaThumb({
  msgId,
  caption,
}: {
  msgId: string;
  caption: string | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/messages/${msgId}/media-url`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { url?: string } | null) => {
        if (alive && j?.url) setUrl(j.url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [msgId]);

  return (
    <>
      <button
        onClick={() => url && setOpen(true)}
        disabled={!url}
        className="aspect-square rounded-md overflow-hidden border border-slate-200 bg-slate-100 active:opacity-70 transition"
        title={caption ?? "Imagem"}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs text-slate-400">…</span>
        )}
      </button>
      {open && url && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-6"
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={caption ?? ""}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </>
  );
}

function MediaDoc({
  msgId,
  caption,
  direction,
}: {
  msgId: string;
  caption: string;
  direction: "inbound" | "outbound";
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/messages/${msgId}/media-url`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { url?: string } | null) => {
        if (alive && j?.url) setUrl(j.url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [msgId]);

  return (
    <li>
      <a
        href={url ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-2 py-2 rounded-md bg-white border border-slate-200 active:opacity-70"
      >
        <span className="text-lg shrink-0">📄</span>
        <span className="flex-1 min-w-0 text-[13px] font-medium text-slate-700 truncate">
          {caption}
        </span>
        <span
          className="text-[10px] uppercase tracking-wider text-slate-400 shrink-0"
          aria-label={direction === "outbound" ? "Enviado" : "Recebido"}
        >
          {direction === "outbound" ? "↑" : "↓"}
        </span>
      </a>
    </li>
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

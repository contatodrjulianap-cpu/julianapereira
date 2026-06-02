// Status canônicos do pipeline de leads (Sakura + digital).
// Server-safe (sem "use client") pra poder ser importado em Server Components
// (funnel/ads) e na rota PATCH. O lead-modal.tsx re-exporta tudo isto pros
// componentes client que já importavam de "../lead-modal".
//
// O "Follow up" único (legado: status "proposal") foi quebrado em 7 estágios
// FU1…FU7 — um por toque da cadência. Cada um vira uma coluna no Kanban.

export const FOLLOW_UP_STATUSES = [
  "follow_up_1",
  "follow_up_2",
  "follow_up_3",
  "follow_up_4",
  "follow_up_5",
  "follow_up_6",
  "follow_up_7",
] as const;

export const STATUS_OPTIONS = [
  "new",
  "contacted",
  "qualified",
  "scheduled",
  "attended",
  ...FOLLOW_UP_STATUSES,
  "won",
  "lost",
  "disqualified",
];

// Status "em negociação" (entre contatado e fechado) — usado em métricas/funil.
export const ENGAGED_STATUSES = [
  "contacted",
  "qualified",
  "scheduled",
  "attended",
  ...FOLLOW_UP_STATUSES,
];

const TERMINAL = new Set(["won", "lost", "disqualified"]);

export const STATUS_LABEL: Record<string, string> = {
  new: "📨 Novo",
  contacted: "📞 Contatado",
  qualified: "✅ Qualificado",
  scheduled: "📆 Agendado",
  attended: "🪑 Compareceu",
  follow_up_1: "⏰ Follow up 1",
  follow_up_2: "⏰ Follow up 2",
  follow_up_3: "⏰ Follow up 3",
  follow_up_4: "⏰ Follow up 4",
  follow_up_5: "⏰ Follow up 5",
  follow_up_6: "⏰ Follow up 6",
  follow_up_7: "⏰ Follow up 7",
  won: "🎉 Fechado",
  lost: "❌ Perdido",
  disqualified: "🚫 Desqualificado",
  // legado — leads antigos antes da migração proposal→follow_up_1
  proposal: "⏰ Follow up",
};

export const STATUS_BADGE: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-indigo-100 text-indigo-800",
  qualified: "bg-amber-100 text-amber-800",
  scheduled: "bg-cyan-100 text-cyan-800",
  attended: "bg-teal-100 text-teal-800",
  // gradiente rosa→vermelho conforme o toque avança (FU7 = último, mais urgente)
  follow_up_1: "bg-pink-100 text-pink-800",
  follow_up_2: "bg-rose-100 text-rose-800",
  follow_up_3: "bg-fuchsia-100 text-fuchsia-800",
  follow_up_4: "bg-purple-100 text-purple-800",
  follow_up_5: "bg-violet-100 text-violet-800",
  follow_up_6: "bg-orange-100 text-orange-800",
  follow_up_7: "bg-red-100 text-red-800",
  won: "bg-emerald-100 text-emerald-800",
  lost: "bg-red-100 text-red-800",
  disqualified: "bg-zinc-200 text-zinc-700",
  proposal: "bg-pink-100 text-pink-800",
};

export function isFollowUpStatus(s?: string | null): boolean {
  return !!s && (FOLLOW_UP_STATUSES as readonly string[]).includes(s);
}

// Próximo status de follow up dado o status atual — usado pra auto-avanço ao
// agendar um follow_up_at sem mexer no status na mão.
// Regras:
//  - status terminal (won/lost/disqualified) → null (não avança)
//  - pré-cadência (new/contacted/qualified) ou legado "proposal" → FU1
//  - FU1…FU6 → próximo
//  - FU7 (último toque) → null (não avança além)
export function nextFollowUpStatus(cur?: string | null): string | null {
  if (cur && TERMINAL.has(cur)) return null;
  const idx = FOLLOW_UP_STATUSES.indexOf((cur ?? "") as (typeof FOLLOW_UP_STATUSES)[number]);
  if (idx === -1) return FOLLOW_UP_STATUSES[0];
  if (idx >= FOLLOW_UP_STATUSES.length - 1) return null;
  return FOLLOW_UP_STATUSES[idx + 1];
}

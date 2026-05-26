"use client";

import type { LeadFull } from "../lead-modal";

export type Bucket =
  | "todos"
  | "novos"
  | "em_contato"
  | "follow_up"
  | "fechados"
  | "perdidos"
  | "desqualificados";

const BUCKETS: Array<{ key: Bucket; label: string; emoji: string }> = [
  { key: "todos", label: "Todos", emoji: "💬" },
  { key: "novos", label: "Novos", emoji: "🆕" },
  { key: "em_contato", label: "Em contato", emoji: "🤝" },
  { key: "follow_up", label: "Follow up", emoji: "⏰" },
  { key: "fechados", label: "Fechados", emoji: "✅" },
  { key: "perdidos", label: "Perdidos", emoji: "❌" },
  { key: "desqualificados", label: "Desqualif.", emoji: "🚫" },
];

// Pra Sakura, "Avaliação" e "Follow up" são a mesma fase: lead que recebeu
// orçamento e está em acompanhamento. Status="proposal" no DB → bucket "follow_up".
// Lead com follow_up_at agendado (não-final) também cai no mesmo bucket.
export function bucketOf(lead: {
  status: string | null;
  follow_up_at: string | null;
}): Exclude<Bucket, "todos"> {
  if (
    lead.follow_up_at &&
    lead.status !== "won" &&
    lead.status !== "lost" &&
    lead.status !== "disqualified"
  ) {
    return "follow_up";
  }
  switch (lead.status) {
    case "new":
      return "novos";
    case "contacted":
    case "qualified":
      return "em_contato";
    case "proposal":
      return "follow_up";
    case "won":
      return "fechados";
    case "lost":
      return "perdidos";
    case "disqualified":
      return "desqualificados";
    default:
      return "novos";
  }
}

export function PipelineBar({
  active,
  onChange,
  counts,
}: {
  active: Bucket;
  onChange: (b: Bucket) => void;
  counts: Record<Bucket, number>;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-2 px-3 pb-2 min-w-max">
        {BUCKETS.map((b) => {
          const isActive = active === b.key;
          const count = counts[b.key] ?? 0;
          return (
            <button
              key={b.key}
              onClick={() => onChange(b.key)}
              className="flex flex-col items-center justify-center px-3 py-1.5 rounded-full transition shrink-0"
              style={{
                background: isActive ? "var(--sakura-cocoa)" : "rgb(241 245 249)",
                color: isActive ? "var(--sakura-cream)" : "rgb(51 65 85)",
              }}
            >
              <span className="text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-[14px]">{b.emoji}</span>
                {b.label}
                <span
                  className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px]"
                  style={{
                    background: isActive
                      ? "rgba(255,255,255,0.18)"
                      : "rgb(226 232 240)",
                  }}
                >
                  {count}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function countByBucket(leads: LeadFull[]): Record<Bucket, number> {
  const counts: Record<Bucket, number> = {
    todos: leads.length,
    novos: 0,
    em_contato: 0,
    follow_up: 0,
    fechados: 0,
    perdidos: 0,
    desqualificados: 0,
  };
  for (const l of leads) counts[bucketOf(l)]++;
  return counts;
}

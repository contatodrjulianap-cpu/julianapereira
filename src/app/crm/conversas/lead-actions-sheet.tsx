"use client";

import { BottomSheet } from "./bottom-sheet";
import { SourceBadge } from "./source-icons";

const PIPELINE = [
  { value: "new", emoji: "🆕", label: "Novos" },
  { value: "contacted", emoji: "🤝", label: "Em contato" },
  { value: "proposal", emoji: "⏰", label: "Follow up" },
  { value: "won", emoji: "✅", label: "Fechado" },
  { value: "lost", emoji: "❌", label: "Perdido" },
] as const;

const SOURCES = [
  { value: "instagram", label: "Instagram" },
  { value: "google", label: "Google" },
  { value: "tiktok", label: "TikTok" },
  { value: "quiz", label: "Quiz" },
  { value: "indicacao", label: "Indicação" },
  { value: "organico", label: "Orgânico / SEO" },
  { value: "whatsapp", label: "WhatsApp direto" },
];

export type LeadActionPayload =
  | { kind: "status"; value: (typeof PIPELINE)[number]["value"] }
  | { kind: "source"; value: string }
  | { kind: "pin"; value: boolean }
  | { kind: "follow_up"; days: number | null }
  | { kind: "copy_phone" }
  | { kind: "open_details" };

export function LeadActionsSheet({
  open,
  lead,
  onAction,
  onClose,
}: {
  open: boolean;
  lead: {
    id: string;
    name: string | null;
    phone: string;
    status: string | null;
    source: string | null;
    pinned: boolean;
  } | null;
  onAction: (a: LeadActionPayload) => void;
  onClose: () => void;
}) {
  if (!lead) return null;

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="85vh">
      <header className="px-5 pb-3">
        <h3 className="text-base font-semibold text-slate-900">
          {lead.name ?? "Sem nome"}
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">{lead.phone}</p>
      </header>

      <Section title="Mover pipeline">
        <div className="px-3 grid grid-cols-5 gap-1.5">
          {PIPELINE.map((p) => {
            const isCurrent = lead.status === p.value;
            return (
              <button
                key={p.value}
                onClick={() => onAction({ kind: "status", value: p.value })}
                className="flex flex-col items-center gap-1 py-2.5 rounded-lg active:bg-slate-100"
                style={{
                  background: isCurrent ? "rgb(241 245 249)" : "transparent",
                }}
              >
                <span className="text-2xl">{p.emoji}</span>
                <span className="text-[10px] font-semibold text-slate-700 leading-tight text-center">
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Ações rápidas">
        <div className="px-3 grid grid-cols-4 gap-1.5">
          <QuickAction
            emoji={lead.pinned ? "📌" : "📍"}
            label={lead.pinned ? "Desfixar" : "Fixar"}
            onClick={() => onAction({ kind: "pin", value: !lead.pinned })}
          />
          <QuickAction
            emoji="⏰"
            label="Lembrar amanhã"
            onClick={() => onAction({ kind: "follow_up", days: 1 })}
          />
          <QuickAction
            emoji="📋"
            label="Copiar telefone"
            onClick={() => onAction({ kind: "copy_phone" })}
          />
          <QuickAction
            emoji="🔍"
            label="Detalhes"
            onClick={() => onAction({ kind: "open_details" })}
          />
        </div>
      </Section>

      <Section title="Origem do lead">
        <ul className="px-2 pb-2">
          {SOURCES.map((opt) => {
            const isCurrent = (lead.source ?? "")
              .toLowerCase()
              .includes(opt.value);
            return (
              <li key={opt.value}>
                <button
                  onClick={() =>
                    onAction({ kind: "source", value: opt.value })
                  }
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg active:bg-slate-50"
                >
                  <SourceBadge source={opt.value} />
                  <span className="flex-1 text-left text-[15px] text-slate-800">
                    {opt.label}
                  </span>
                  {isCurrent && (
                    <span className="text-[var(--sakura-cocoa,#3b2d28)] text-lg">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </Section>
    </BottomSheet>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-slate-100 py-2">
      <h4 className="px-5 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h4>
      {children}
    </section>
  );
}

function QuickAction({
  emoji,
  label,
  onClick,
}: {
  emoji: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 py-2.5 rounded-lg active:bg-slate-100"
    >
      <span className="text-2xl">{emoji}</span>
      <span className="text-[10px] font-semibold text-slate-700 leading-tight text-center">
        {label}
      </span>
    </button>
  );
}

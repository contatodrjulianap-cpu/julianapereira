"use client";

import { motion, AnimatePresence } from "framer-motion";

export type AttachmentAction =
  | "camera"
  | "document"
  | "contact"
  | "location"
  | "pipeline"
  | "quick_reply"
  | "source";

type Item = {
  kind: AttachmentAction;
  emoji: string;
  label: string;
  bg: string;
  fg: string;
};

const ATTACHMENTS: Item[] = [
  { kind: "camera", emoji: "📷", label: "Câmera", bg: "bg-rose-100", fg: "text-rose-700" },
  { kind: "document", emoji: "📄", label: "Documento", bg: "bg-indigo-100", fg: "text-indigo-700" },
  { kind: "contact", emoji: "👤", label: "Contato", bg: "bg-sky-100", fg: "text-sky-700" },
  { kind: "location", emoji: "📍", label: "Endereço da clínica", bg: "bg-emerald-100", fg: "text-emerald-700" },
];

const ACTIONS: Item[] = [
  { kind: "pipeline", emoji: "🔄", label: "Alterar pipeline", bg: "bg-amber-100", fg: "text-amber-700" },
  { kind: "quick_reply", emoji: "⚡", label: "Resposta rápida", bg: "bg-yellow-100", fg: "text-yellow-700" },
  { kind: "source", emoji: "🏷️", label: "Origem do lead", bg: "bg-purple-100", fg: "text-purple-700" },
];

export function AttachmentSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (kind: AttachmentAction) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
            aria-hidden
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 32 }}
            className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl shadow-xl pb-[max(env(safe-area-inset-bottom),12px)]"
          >
            <div className="flex justify-center py-2">
              <span className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>

            <Section title="Enviar">
              <Grid items={ATTACHMENTS} onPick={onPick} />
            </Section>

            <Section title="Ações do lead">
              <Grid items={ACTIONS} onPick={onPick} />
            </Section>
          </motion.div>
        </>
      )}
    </AnimatePresence>
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
    <section className="border-t border-slate-100 first:border-t-0 py-3">
      <h4 className="px-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h4>
      {children}
    </section>
  );
}

function Grid({
  items,
  onPick,
}: {
  items: Item[];
  onPick: (kind: AttachmentAction) => void;
}) {
  return (
    <div className="px-4 grid grid-cols-4 gap-3">
      {items.map((it) => (
        <button
          key={it.kind}
          onClick={() => onPick(it.kind)}
          className="flex flex-col items-center gap-1.5 active:opacity-70"
        >
          <span
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-[22px] ${it.bg}`}
          >
            {it.emoji}
          </span>
          <span className={`text-[10px] font-semibold text-center leading-tight ${it.fg}`}>
            {it.label}
          </span>
        </button>
      ))}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import type { LeadFull } from "../lead-modal";
import type { LastMessage } from "./page";
import { SourceBadge } from "./source-icons";

type LeadCard = LeadFull & {
  selfie_signed_url?: string | null;
  last_message: LastMessage | null;
};

function temperatureOf(lead: LeadCard): "🔥" | "☀️" | "❄️" | null {
  if (!lead.last_message_at) return null;
  const ms = Date.now() - new Date(lead.last_message_at).getTime();
  const h = ms / 3_600_000;
  if (h < 1) return "🔥";
  if (h < 24) return "☀️";
  return "❄️";
}

// Status final (won/lost) substitui a temperatura — pra lead fechado
// ou perdido, o tempo desde última msg não é mais relevante.
function statusEmojiOf(status: string | null): "✅" | "❌" | null {
  if (status === "won") return "✅";
  if (status === "lost") return "❌";
  return null;
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function initialsOf(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]!.toUpperCase();
  return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase();
}

async function patchLead(id: string, payload: Record<string, unknown>) {
  const res = await fetch(`/api/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "erro ao atualizar");
  }
  return res.json();
}

const REVEAL = 160; // px revelados em cada lado
const SNAP = 70; // threshold pra snap-open

export function ConversationCard({
  lead,
  onPatched,
  onOpenSheet,
}: {
  lead: LeadCard;
  onPatched: (lead: LeadFull) => void;
  onOpenSheet: (lead: LeadCard) => void;
}) {
  const router = useRouter();
  const x = useMotionValue(0);
  const [busy, setBusy] = useState(false);
  const dragging = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ações esquerdas (revelam arrastando o card pra esquerda → x < 0)
  const leftOpacity = useTransform(x, [-REVEAL, -10, 0], [1, 0.3, 0]);
  const leftPointer = useTransform(x, (v) => (v < -10 ? "auto" : "none"));
  // Ações direitas (revelam arrastando pra direita → x > 0)
  const rightOpacity = useTransform(x, [0, 10, REVEAL], [0, 0.3, 1]);
  const rightPointer = useTransform(x, (v) => (v > 10 ? "auto" : "none"));

  function close() {
    animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
  }

  async function applyAction(payload: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      const { lead: updated } = await patchLead(lead.id, payload);
      onPatched(updated as LeadFull);
      close();
    } catch (e) {
      alert(e instanceof Error ? e.message : "erro");
    } finally {
      setBusy(false);
    }
  }

  const statusEmoji = statusEmojiOf(lead.status);
  const hasFollowUp = !!lead.follow_up_at && !statusEmoji; // não mostra ⏰ pra won/lost
  const temp = statusEmoji || hasFollowUp ? null : temperatureOf(lead);
  const time = lead.last_message?.created_at ?? lead.last_message_at;
  const preview = lead.last_message?.text ?? "—";
  const isOutbound = lead.last_message?.direction === "outbound";

  return (
    <li className="relative bg-white border-b border-slate-100 overflow-hidden isolate">
      {/* Ações reveladas ao arrastar pra ESQUERDA (alinhadas à direita) */}
      <motion.div
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{
          width: REVEAL,
          opacity: leftOpacity,
          pointerEvents: leftPointer,
        }}
        aria-hidden
      >
        <ActionButton
          color="#22c55e"
          icon="✅"
          label="Comprou"
          onClick={() => applyAction({ status: "won" })}
        />
        <ActionButton
          color="#ef4444"
          icon="❌"
          label="Perdido"
          onClick={() => applyAction({ status: "lost" })}
        />
      </motion.div>

      {/* Ações reveladas ao arrastar pra DIREITA (alinhadas à esquerda) */}
      <motion.div
        className="absolute inset-y-0 left-0 flex items-stretch"
        style={{
          width: REVEAL,
          opacity: rightOpacity,
          pointerEvents: rightPointer,
        }}
        aria-hidden
      >
        <ActionButton
          color="#0ea5e9"
          icon={lead.pinned ? "📌" : "📍"}
          label={lead.pinned ? "Desfixar" : "Fixar"}
          onClick={() => applyAction({ pinned: !lead.pinned })}
        />
        <ActionButton
          color="#a855f7"
          icon="⏰"
          label="Follow"
          onClick={() => {
            const at = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
            void applyAction({ follow_up_at: at });
          }}
        />
      </motion.div>

      {/* Card draggable */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -REVEAL, right: REVEAL }}
        dragElastic={0.05}
        style={{ x, background: "white", position: "relative", zIndex: 1 }}
        onDragStart={() => {
          dragging.current = true;
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
        }}
        onDragEnd={(_, info) => {
          setTimeout(() => (dragging.current = false), 50);
          const v = info.offset.x;
          if (v < -SNAP) animate(x, -REVEAL, { type: "spring", stiffness: 350, damping: 30 });
          else if (v > SNAP) animate(x, REVEAL, { type: "spring", stiffness: 350, damping: 30 });
          else close();
        }}
        onPointerDown={() => {
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
          longPressTimer.current = setTimeout(() => {
            if (!dragging.current) {
              if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate(20);
              }
              onOpenSheet(lead);
            }
          }, 500);
        }}
        onPointerUp={() => {
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
        }}
        onPointerCancel={() => {
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
        }}
        onClick={(e) => {
          if (dragging.current) {
            e.preventDefault();
            return;
          }
          // Se a row está aberta (revelando ação), o click fecha em vez de navegar
          if (Math.abs(x.get()) > 5) {
            close();
            return;
          }
          router.push(`/crm/conversas/${lead.id}`);
        }}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none touch-pan-y"
      >
        {/* Avatar */}
        <div className="shrink-0 relative">
          {lead.selfie_signed_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lead.selfie_signed_url}
              alt=""
              className="w-12 h-12 rounded-full object-cover bg-slate-200"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-semibold text-sm">
              {initialsOf(lead.name)}
            </div>
          )}
          {lead.pinned && (
            <span className="absolute -top-1 -right-1 text-[12px]" aria-label="Fixado">
              📌
            </span>
          )}
        </div>

        {/* Texto */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-semibold text-[15px] text-slate-900 truncate">
              {lead.name ?? lead.phone}
              {statusEmoji && (
                <span className="ml-1.5 text-[13px]">{statusEmoji}</span>
              )}
              {hasFollowUp && (
                <span className="ml-1.5 text-[13px]" title="Follow up agendado">
                  ⏰
                </span>
              )}
              {temp && <span className="ml-1.5 text-[13px]">{temp}</span>}
            </p>
            <span className="text-[11px] text-slate-400 shrink-0">
              {time ? relativeTime(time) : ""}
            </span>
          </div>
          <p className="text-[13px] text-slate-500 truncate leading-snug">
            {isOutbound && <span className="text-slate-400">você: </span>}
            {preview}
          </p>
        </div>

        <SourceBadge source={lead.source} />
      </motion.div>
    </li>
  );
}

function ActionButton({
  color,
  icon,
  label,
  onClick,
}: {
  color: string;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center text-white text-[10px] font-semibold gap-0.5 active:opacity-80"
      style={{ background: color, minWidth: 80 }}
    >
      <span className="text-[18px]">{icon}</span>
      {label}
    </button>
  );
}

"use client";

import { BottomSheet } from "../bottom-sheet";

export type MessageActionPayload =
  | { kind: "reply" }
  | { kind: "copy" }
  | { kind: "save_template" }
  | { kind: "set_selfie" };

export function MessageActionsSheet({
  open,
  msg,
  onAction,
  onClose,
}: {
  open: boolean;
  msg: {
    id: string;
    text: string | null;
    direction: "inbound" | "outbound";
    media_type: string | null;
  } | null;
  onAction: (a: MessageActionPayload) => void;
  onClose: () => void;
}) {
  if (!msg) return null;
  const hasText = !!msg.text;
  const isOutbound = msg.direction === "outbound";
  const isInboundImage =
    msg.direction === "inbound" && msg.media_type === "image";

  return (
    <BottomSheet open={open} onClose={onClose}>
      <header className="px-5 pb-3">
        <h3 className="text-base font-semibold text-slate-900">
          Opções da mensagem
        </h3>
      </header>

      <ul className="px-2 pb-3 space-y-1">
        <ActionRow
          emoji="↩️"
          label="Responder"
          onClick={() => onAction({ kind: "reply" })}
        />
        {hasText && (
          <ActionRow
            emoji="📋"
            label="Copiar texto"
            onClick={() => onAction({ kind: "copy" })}
          />
        )}
        {isInboundImage && (
          <ActionRow
            emoji="🖼️"
            label="Usar como foto de perfil"
            onClick={() => onAction({ kind: "set_selfie" })}
          />
        )}
        {isOutbound && hasText && (
          <ActionRow
            emoji="⚡"
            label="Salvar como resposta rápida"
            onClick={() => onAction({ kind: "save_template" })}
          />
        )}
      </ul>
    </BottomSheet>
  );
}

function ActionRow({
  emoji,
  label,
  onClick,
}: {
  emoji: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg active:bg-slate-100 text-left"
      >
        <span className="text-2xl shrink-0">{emoji}</span>
        <span className="text-[15px] font-medium text-slate-800">{label}</span>
      </button>
    </li>
  );
}

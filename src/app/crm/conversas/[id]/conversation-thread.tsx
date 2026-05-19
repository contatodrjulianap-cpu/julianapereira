"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ARCH_LABEL, type LeadFull } from "../../lead-modal";
import { firstNameOf } from "@/lib/template-vars";
import { QuickRepliesSheet } from "./quick-replies-sheet";
import { SaveTemplateModal } from "./save-template-modal";
import { AttachmentSheet, type AttachmentAction } from "./attachment-sheet";
import {
  LeadActionsSheet,
  type LeadActionPayload,
} from "../lead-actions-sheet";

// TODO: configurar via integration_config (admin edita em Você → Integrações).
const CLINIC_ADDRESS_MESSAGE = `📍 Clínica Sakura
Av. Brigadeiro Faria Lima, 1234 — Itaim Bibi, São Paulo - SP
Maps: https://maps.google.com/?q=Clinica+Sakura+Sao+Paulo`;

type Message = {
  id: string;
  lead_id: string;
  direction: "inbound" | "outbound";
  text: string;
  created_at: string;
};

export function ConversationThread({
  lead,
  initialMessages,
  selfieSignedUrl,
}: {
  lead: LeadFull;
  initialMessages: Message[];
  selfieSignedUrl: string | null;
}) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [currentLead, setCurrentLead] = useState<LeadFull>(lead);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [actionsSheetOpen, setActionsSheetOpen] = useState(false);
  const [saveModalText, setSaveModalText] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const firstName = firstNameOf(currentLead.name);

  function handleAttachment(kind: AttachmentAction) {
    setAttachOpen(false);
    switch (kind) {
      case "camera":
        cameraInputRef.current?.click();
        break;
      case "document":
        alert("Envio de documento ainda em desenvolvimento.");
        break;
      case "contact":
        alert("Compartilhar contato ainda em desenvolvimento.");
        break;
      case "location":
        setDraft((cur) =>
          cur.trim() ? `${cur}\n\n${CLINIC_ADDRESS_MESSAGE}` : CLINIC_ADDRESS_MESSAGE,
        );
        setTimeout(() => inputRef.current?.focus(), 50);
        break;
      case "quick_reply":
        setQuickOpen(true);
        break;
      case "pipeline":
      case "source":
        setActionsSheetOpen(true);
        break;
    }
  }

  async function handleSheetAction(a: LeadActionPayload) {
    if (a.kind === "open_details" || a.kind === "copy_phone") {
      setActionsSheetOpen(false);
      if (a.kind === "copy_phone") {
        try {
          await navigator.clipboard.writeText(currentLead.phone);
        } catch {
          /* noop */
        }
      }
      return;
    }
    const payload =
      a.kind === "status"
        ? { status: a.value }
        : a.kind === "source"
          ? { source: a.value }
          : a.kind === "pin"
            ? { pinned: a.value }
            : a.kind === "follow_up"
              ? {
                  follow_up_at: a.days
                    ? new Date(Date.now() + a.days * 86400_000).toISOString()
                    : null,
                }
              : null;
    if (!payload) {
      setActionsSheetOpen(false);
      return;
    }
    try {
      const res = await fetch(`/api/leads/${currentLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "erro");
      setCurrentLead((c) => ({ ...c, ...(data.lead as LeadFull) }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "erro");
    } finally {
      setActionsSheetOpen(false);
    }
  }

  useEffect(() => {
    const ch = supabase
      .channel(`msgs-${lead.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `lead_id=eq.${lead.id}`,
        },
        (payload) => setMessages((prev) => [...prev, payload.new as Message]),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [lead.id, supabase]);

  useEffect(() => {
    scrollEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!draft.trim()) return;
    setSending(true);
    const res = await fetch("/api/zapi/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: lead.id, message: draft }),
    });
    setSending(false);
    if (res.ok) setDraft("");
    else {
      const data = await res.json().catch(() => ({}));
      alert(`Erro: ${data.error ?? "envio falhou"}`);
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#efeae2] md:relative md:bg-slate-50/60">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-3 py-2 flex items-center gap-3 sticky top-0 z-10">
        <Link
          href="/crm/conversas"
          className="text-slate-600 px-1 py-1 active:opacity-60"
          aria-label="Voltar"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>

        {selfieSignedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={selfieSignedUrl}
            alt=""
            className="w-10 h-10 rounded-full object-cover bg-slate-200"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-sm font-semibold">
            {(lead.name ?? "?").trim()[0]?.toUpperCase() ?? "?"}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[15px] text-slate-900 truncate leading-tight">
            {lead.name ?? lead.phone}
          </p>
          <p className="text-[11px] text-slate-500 leading-tight truncate">
            {lead.phone}
            {lead.archetype && ` · ${ARCH_LABEL[lead.archetype]}`}
            {lead.geo && ` · ${lead.geo}`}
          </p>
        </div>
      </header>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {messages.length === 0 && (
          <p className="text-center text-xs text-slate-400 py-8">
            Nenhuma mensagem trocada ainda.
          </p>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const showTime =
            !prev ||
            new Date(m.created_at).getTime() -
              new Date(prev.created_at).getTime() >
              5 * 60_000;
          return (
            <div key={m.id}>
              {showTime && (
                <p className="text-center text-[10px] text-slate-500 my-2">
                  {new Date(m.created_at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
              <div
                className={`max-w-[78%] px-3 py-2 rounded-lg text-[14px] shadow-sm select-none ${
                  m.direction === "outbound"
                    ? "ml-auto bg-[#d9fdd3] text-slate-800 cursor-pointer"
                    : "mr-auto bg-white text-slate-800"
                }`}
                onPointerDown={
                  m.direction === "outbound"
                    ? () => {
                        if (longPressTimer.current)
                          clearTimeout(longPressTimer.current);
                        longPressTimer.current = setTimeout(() => {
                          if (
                            typeof navigator !== "undefined" &&
                            navigator.vibrate
                          ) {
                            navigator.vibrate(20);
                          }
                          setSaveModalText(m.text);
                        }, 500);
                      }
                    : undefined
                }
                onPointerUp={() => {
                  if (longPressTimer.current)
                    clearTimeout(longPressTimer.current);
                }}
                onPointerCancel={() => {
                  if (longPressTimer.current)
                    clearTimeout(longPressTimer.current);
                }}
                title={
                  m.direction === "outbound"
                    ? "Segure pra salvar como resposta rápida"
                    : undefined
                }
              >
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={scrollEnd} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-slate-200 px-2 py-2 pb-[max(env(safe-area-inset-bottom),8px)] flex items-end gap-1.5">
        <button
          onClick={() => setAttachOpen(true)}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-slate-600 active:bg-slate-100 transition"
          aria-label="Anexar / ações"
          title="Anexar / ações"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Mensagem"
            rows={1}
            className="w-full pl-3 pr-11 py-2 text-sm bg-slate-100 rounded-2xl outline-none resize-none max-h-32"
          />
          <button
            onClick={() => setQuickOpen(true)}
            className="absolute right-1 bottom-1 w-9 h-9 rounded-full flex items-center justify-center text-amber-500 active:bg-amber-100 transition"
            aria-label="Respostas rápidas"
            title="Respostas rápidas"
          >
            <span className="text-[20px] leading-none">⚡</span>
          </button>
        </div>
        <button
          onClick={send}
          disabled={sending || !draft.trim()}
          className="shrink-0 w-10 h-10 rounded-full bg-[var(--sakura-cocoa)] text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition"
          aria-label="Enviar"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M3 11L21 3L13 21L11 13L3 11Z" />
          </svg>
        </button>
      </div>

      <QuickRepliesSheet
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        ctx={{ primeiro_nome: firstName ?? undefined }}
        onPick={(text, replyId) => {
          setDraft((cur) => (cur.trim() ? `${cur} ${text}` : text));
          setQuickOpen(false);
          fetch(`/api/quick-replies/${replyId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uses_count_increment: true }),
          }).catch(() => {});
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
      />

      <SaveTemplateModal
        open={!!saveModalText}
        originalText={saveModalText ?? ""}
        leadFullName={currentLead.name}
        onClose={() => setSaveModalText(null)}
        onSaved={() => setSaveModalText(null)}
      />

      <AttachmentSheet
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
        onPick={handleAttachment}
      />

      <LeadActionsSheet
        open={actionsSheetOpen}
        lead={currentLead}
        onAction={handleSheetAction}
        onClose={() => setActionsSheetOpen(false)}
      />

      {/* Input invisível: dispara a câmera quando "Câmera" é tocado no sheet */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={() => {
          // Upload + envio via Z-API ainda não implementados.
          alert("Captura recebida. Envio de mídia via Z-API entra na próxima sprint.");
        }}
      />
    </div>
  );
}

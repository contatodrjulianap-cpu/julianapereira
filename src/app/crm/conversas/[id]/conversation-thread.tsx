"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ARCH_LABEL, LeadModal, type LeadFull } from "../../lead-modal";
import { firstNameOf } from "@/lib/template-vars";
import { QuickRepliesSheet } from "./quick-replies-sheet";
import { SaveTemplateModal } from "./save-template-modal";
import { AttachmentSheet, type AttachmentAction } from "./attachment-sheet";
import {
  LeadActionsSheet,
  type LeadActionPayload,
} from "../lead-actions-sheet";
import { BottomSheet } from "../bottom-sheet";
import { ContactSheet } from "./contact-sheet";
import { SourceBadge } from "../source-icons";
import {
  MessageActionsSheet,
  type MessageActionPayload,
} from "./message-actions-sheet";

// TODO: configurar via integration_config (admin edita em Você → Integrações).
const CLINIC_ADDRESS_MESSAGE = `📍 Clínica Sakura
Av. Brigadeiro Faria Lima, 1234 — Itaim Bibi, São Paulo - SP
Maps: https://maps.google.com/?q=Clinica+Sakura+Sao+Paulo`;

type Message = {
  id: string;
  lead_id: string;
  direction: "inbound" | "outbound";
  text: string | null;
  media_url: string | null;
  media_type: string | null;
  media_signed_url?: string | null;
  zapi_message_id?: string | null;
  created_at: string;
};

function formatFollowUpShort(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / 86400_000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  return `${dd}/${mm}`;
}

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
  const cameraCaptureRef = useRef<HTMLInputElement>(null);
  const galleryPickerRef = useRef<HTMLInputElement>(null);
  const documentPickerRef = useRef<HTMLInputElement>(null);
  const [cameraSheetOpen, setCameraSheetOpen] = useState(false);
  const [contactSheetOpen, setContactSheetOpen] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [msgActionFor, setMsgActionFor] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  const firstName = firstNameOf(currentLead.name);

  function handleAttachment(kind: AttachmentAction) {
    setAttachOpen(false);
    switch (kind) {
      case "camera":
        // Pequeno delay pra animação do sheet anterior fechar antes do novo abrir
        setTimeout(() => setCameraSheetOpen(true), 250);
        break;
      case "document":
        documentPickerRef.current?.click();
        break;
      case "contact":
        setTimeout(() => setContactSheetOpen(true), 250);
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

  async function uploadAndSendMedia(file: File) {
    if (uploadingMedia) return;
    setUploadingMedia(true);
    try {
      const form = new FormData();
      form.append("lead_id", lead.id);
      form.append("file", file);
      if (draft.trim()) {
        form.append("caption", draft.trim());
      }
      const res = await fetch("/api/zapi/send-media", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "envio falhou");
      setDraft("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "erro ao enviar mídia");
    } finally {
      setUploadingMedia(false);
    }
  }

  // Auto-resize do textarea: até 6 linhas
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 22;
    const maxLines = 6;
    const padding = 16;
    const max = lineHeight * maxLines + padding;
    el.style.height = Math.min(el.scrollHeight, max) + "px";
  }, [draft]);

  async function handleSheetAction(a: LeadActionPayload) {
    if (a.kind === "copy_phone") {
      setActionsSheetOpen(false);
      try {
        await navigator.clipboard.writeText(currentLead.phone);
      } catch {
        /* noop */
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
              : a.kind === "next_contact"
                ? {
                    follow_up_at: a.date
                      ? new Date(`${a.date}T12:00:00`).toISOString()
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
      body: JSON.stringify({
        lead_id: lead.id,
        message: draft,
        reply_to_message_id: replyTo?.zapi_message_id ?? null,
      }),
    });
    setSending(false);
    if (res.ok) {
      setDraft("");
      setReplyTo(null);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(`Erro: ${data.error ?? "envio falhou"}`);
    }
  }

  async function handleMsgAction(a: MessageActionPayload) {
    if (!msgActionFor) return;
    const m = msgActionFor;
    setMsgActionFor(null);

    if (a.kind === "reply") {
      setReplyTo(m);
      setTimeout(() => inputRef.current?.focus(), 80);
      return;
    }
    if (a.kind === "copy" && m.text) {
      try {
        await navigator.clipboard.writeText(m.text);
      } catch {
        /* noop */
      }
      return;
    }
    if (a.kind === "save_template" && m.text) {
      setSaveModalText(m.text);
      return;
    }
    if (a.kind === "set_selfie") {
      try {
        const res = await fetch(
          `/api/leads/${lead.id}/set-selfie-from-message`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message_id: m.id }),
          },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "erro");
        if (data.lead) setCurrentLead(data.lead as LeadFull);
        alert("Foto de perfil atualizada.");
      } catch (e) {
        alert(e instanceof Error ? e.message : "erro");
      }
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#efeae2] md:relative md:inset-auto md:h-full md:w-full">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-3 py-2 flex items-center gap-3 sticky top-0 z-10">
        <Link
          href="/crm/conversas"
          className="md:hidden text-slate-600 px-1 py-1 active:opacity-60"
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

        <button
          onClick={() => setReportOpen(true)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-70"
          title="Ver relatório completo do lead"
        >
          {selfieSignedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selfieSignedUrl}
              alt=""
              className="w-10 h-10 rounded-full object-cover bg-slate-200 shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-sm font-semibold shrink-0">
              {(currentLead.name ?? "?").trim()[0]?.toUpperCase() ?? "?"}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[15px] text-slate-900 truncate leading-tight">
              {currentLead.name ?? currentLead.phone}
              {currentLead.status === "won" && (
                <span className="ml-1.5 text-[12px]">✅</span>
              )}
              {currentLead.status === "lost" && (
                <span className="ml-1.5 text-[12px]">❌</span>
              )}
              {currentLead.follow_up_at &&
                currentLead.status !== "won" &&
                currentLead.status !== "lost" && (
                  <span className="ml-1.5 inline-flex items-baseline gap-1">
                    <span className="text-[12px]">⏰</span>
                    <span
                      className="text-[10px] font-semibold"
                      style={{
                        color:
                          new Date(currentLead.follow_up_at) < new Date()
                            ? "#dc2626"
                            : "#a06a56",
                      }}
                    >
                      {formatFollowUpShort(currentLead.follow_up_at)}
                    </span>
                  </span>
                )}
            </p>
            <p className="text-[11px] text-slate-500 leading-tight truncate">
              {currentLead.phone}
              {currentLead.archetype && ` · ${ARCH_LABEL[currentLead.archetype]}`}
              {currentLead.geo && ` · ${currentLead.geo}`}
            </p>
          </div>
        </button>

        {/* Badge da origem no canto direito */}
        <div
          className="shrink-0"
          title={`Origem: ${currentLead.source ?? "WhatsApp direto"}`}
        >
          <SourceBadge source={currentLead.source} />
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
                className={`max-w-[78%] px-3 py-2 rounded-lg text-[14px] shadow-sm select-none cursor-pointer ${
                  m.direction === "outbound"
                    ? "ml-auto bg-[#d9fdd3] text-slate-800"
                    : "mr-auto bg-white text-slate-800"
                }`}
                onPointerDown={() => {
                  if (longPressTimer.current)
                    clearTimeout(longPressTimer.current);
                  longPressTimer.current = setTimeout(() => {
                    if (
                      typeof navigator !== "undefined" &&
                      navigator.vibrate
                    ) {
                      navigator.vibrate(20);
                    }
                    setMsgActionFor(m);
                  }, 500);
                }}
                onPointerUp={() => {
                  if (longPressTimer.current)
                    clearTimeout(longPressTimer.current);
                }}
                onPointerCancel={() => {
                  if (longPressTimer.current)
                    clearTimeout(longPressTimer.current);
                }}
                title="Segure pra abrir opções (responder, copiar...)"
              >
                {m.media_type === "image" && m.media_signed_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.media_signed_url}
                    alt={m.text ?? "Imagem"}
                    className="rounded-md max-w-full max-h-72 mb-1 object-cover"
                  />
                )}
                {m.media_type === "image" && !m.media_signed_url && m.media_url && (
                  <RemoteImage messageId={m.id} alt={m.text ?? "Imagem"} />
                )}
                {m.media_type === "document" && (
                  <DocumentBubble
                    messageId={m.id}
                    signedUrl={m.media_signed_url ?? null}
                    fileName={m.text ?? "Arquivo"}
                  />
                )}
                {m.text && (
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={scrollEnd} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="bg-white border-t border-slate-200 px-3 py-2 flex items-start gap-2">
          <div
            className="flex-1 min-w-0 border-l-4 pl-2"
            style={{ borderColor: "var(--sakura-rose-2, #a06a56)" }}
          >
            <p className="text-[10px] font-semibold text-[var(--sakura-rose-2,#a06a56)] uppercase tracking-wider">
              {replyTo.direction === "outbound" ? "Você" : "Lead"}
            </p>
            <p className="text-xs text-slate-600 truncate">
              {replyTo.text ??
                (replyTo.media_type === "image"
                  ? "📷 Imagem"
                  : "📄 Mídia")}
            </p>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="text-slate-400 active:opacity-60 p-1"
            aria-label="Cancelar resposta"
          >
            ×
          </button>
        </div>
      )}

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
            placeholder="Mensagem"
            rows={1}
            className="w-full pl-3 pr-11 py-2 text-sm bg-slate-100 rounded-2xl outline-none resize-none overflow-y-auto"
            style={{ minHeight: 40 }}
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

      {/* Sheet: escolher entre tirar foto ou pegar da galeria */}
      <BottomSheet
        open={cameraSheetOpen}
        onClose={() => setCameraSheetOpen(false)}
      >
        <header className="px-5 pb-3">
          <h3 className="text-base font-semibold text-slate-900">Foto</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            De onde você quer mandar?
          </p>
        </header>
        <div className="px-3 pb-3 space-y-2">
          <button
            onClick={() => {
              setCameraSheetOpen(false);
              setTimeout(() => cameraCaptureRef.current?.click(), 100);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 bg-rose-50 rounded-xl active:bg-rose-100 transition"
          >
            <span className="text-2xl">📷</span>
            <span className="text-[15px] font-semibold text-rose-700">
              Tirar foto agora
            </span>
          </button>
          <button
            onClick={() => {
              setCameraSheetOpen(false);
              setTimeout(() => galleryPickerRef.current?.click(), 100);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-50 rounded-xl active:bg-indigo-100 transition"
          >
            <span className="text-2xl">🖼️</span>
            <span className="text-[15px] font-semibold text-indigo-700">
              Escolher dos arquivos
            </span>
          </button>
        </div>
      </BottomSheet>

      <ContactSheet
        open={contactSheetOpen}
        leadId={lead.id}
        onClose={() => setContactSheetOpen(false)}
        onSent={() => setContactSheetOpen(false)}
      />

      <MessageActionsSheet
        open={!!msgActionFor}
        msg={msgActionFor}
        onAction={handleMsgAction}
        onClose={() => setMsgActionFor(null)}
      />

      {reportOpen && (
        <LeadModal
          lead={currentLead}
          onClose={() => setReportOpen(false)}
          onSaved={(updated) => setCurrentLead(updated)}
        />
      )}

      {/* Indicador de upload em andamento */}
      {uploadingMedia && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-xs px-4 py-2 rounded-full shadow-lg z-50">
          Enviando mídia...
        </div>
      )}

      {/* Inputs file invisíveis */}
      <input
        ref={cameraCaptureRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void uploadAndSendMedia(f);
        }}
      />
      <input
        ref={galleryPickerRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void uploadAndSendMedia(f);
        }}
      />
      <input
        ref={documentPickerRef}
        type="file"
        accept="application/pdf,.doc,.docx,.xls,.xlsx,.txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void uploadAndSendMedia(f);
        }}
      />
    </div>
  );
}

function RemoteImage({ messageId, alt }: { messageId: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/messages/${messageId}/media-url`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { url?: string } | null) => {
        if (alive && d?.url) setUrl(d.url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [messageId]);
  if (!url) {
    return (
      <div className="text-xs text-slate-400 py-3 px-2">📷 carregando...</div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className="rounded-md max-w-full max-h-72 mb-1 object-cover"
    />
  );
}

function DocumentBubble({
  messageId,
  signedUrl,
  fileName,
}: {
  messageId: string;
  signedUrl: string | null;
  fileName: string;
}) {
  const [url, setUrl] = useState<string | null>(signedUrl);
  useEffect(() => {
    if (url) return;
    let alive = true;
    fetch(`/api/messages/${messageId}/media-url`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { url?: string } | null) => {
        if (alive && d?.url) setUrl(d.url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [messageId, url]);
  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-2 py-2 bg-white/40 rounded-md mb-1 active:opacity-70"
    >
      <span className="text-xl shrink-0">📄</span>
      <span className="text-[13px] font-semibold text-slate-700 truncate">
        {fileName}
      </span>
    </a>
  );
}

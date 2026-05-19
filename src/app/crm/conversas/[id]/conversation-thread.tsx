"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ARCH_LABEL, type LeadFull } from "../../lead-modal";

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
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollEnd = useRef<HTMLDivElement>(null);

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
                className={`max-w-[78%] px-3 py-2 rounded-lg text-[14px] shadow-sm ${
                  m.direction === "outbound"
                    ? "ml-auto bg-[#d9fdd3] text-slate-800"
                    : "mr-auto bg-white text-slate-800"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={scrollEnd} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-slate-200 px-2 py-2 pb-[max(env(safe-area-inset-bottom),8px)] flex items-end gap-2">
        <textarea
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
          className="flex-1 px-3 py-2 text-sm bg-slate-100 rounded-2xl outline-none resize-none max-h-32"
        />
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
    </div>
  );
}

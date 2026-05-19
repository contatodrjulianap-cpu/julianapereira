"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LeadFull } from "../lead-modal";
import type { LastMessage } from "./page";
import { SourceBadge } from "./source-icons";

type LeadCard = LeadFull & {
  selfie_signed_url?: string | null;
  last_message: LastMessage | null;
};

// Temperatura por tempo desde última msg inbound do lead.
// 🔥 quente (<1h), ☀️ morno (<24h), ❄️ frio (>24h)
function temperatureOf(lead: LeadCard): "🔥" | "☀️" | "❄️" | null {
  if (!lead.last_message_at) return null;
  const ms = Date.now() - new Date(lead.last_message_at).getTime();
  const h = ms / 3_600_000;
  if (h < 1) return "🔥";
  if (h < 24) return "☀️";
  return "❄️";
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

export function ConversationList({ initialLeads }: { initialLeads: LeadCard[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initialLeads;
    return initialLeads.filter((l) => {
      const text = `${l.name ?? ""} ${l.phone} ${l.last_message?.text ?? ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [initialLeads, search]);

  return (
    <div className="flex-1 flex flex-col bg-white min-h-0">
      {/* Header mobile */}
      <header className="md:hidden sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3">
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">
          Conversas
        </h1>
      </header>

      {/* Search */}
      <div className="px-4 py-2 border-b border-slate-100 bg-white">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar nome, telefone ou mensagem..."
          className="w-full px-3 py-2 text-sm bg-slate-100 rounded-lg outline-none focus:bg-slate-200/70 transition"
        />
      </div>

      {/* Lista */}
      <ul className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <li className="p-6 text-center text-sm text-slate-400">
            Nenhuma conversa.
          </li>
        ) : (
          filtered.map((lead) => (
            <ConversationCard key={lead.id} lead={lead} />
          ))
        )}
      </ul>
    </div>
  );
}

function ConversationCard({ lead }: { lead: LeadCard }) {
  const temp = temperatureOf(lead);
  const time = lead.last_message?.created_at ?? lead.last_message_at;
  const preview = lead.last_message?.text ?? "—";
  const isOutbound = lead.last_message?.direction === "outbound";

  return (
    <Link
      href={`/crm/conversas/${lead.id}`}
      className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 active:bg-slate-50 transition"
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
      </div>

      {/* Texto */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-semibold text-[15px] text-slate-900 truncate">
            {lead.name ?? lead.phone}
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

      {/* Badge da origem (logo do canal) */}
      <SourceBadge source={lead.source} />
    </Link>
  );
}

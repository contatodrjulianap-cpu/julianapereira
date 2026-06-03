"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { LeadFull } from "../lead-modal";
import type { LastMessage } from "./load-leads";
import { ConversationCard } from "./conversation-card";
import {
  PipelineBar,
  bucketOf,
  countByBucket,
  type Bucket,
} from "./pipeline-bar";
import { LeadActionsSheet, type LeadActionPayload } from "./lead-actions-sheet";
import { NewConversationModal } from "./new-conversation";

type LeadCard = LeadFull & {
  selfie_signed_url?: string | null;
  last_message: LastMessage | null;
  unread?: boolean;
};

type UrgencyFilter = "todos" | "hoje" | "vencidos" | "proximos" | "frios";

const URGENCY_CHIPS: Array<{ key: UrgencyFilter; emoji: string; label: string }> = [
  { key: "todos", emoji: "📋", label: "Tudo" },
  { key: "hoje", emoji: "🔥", label: "Hoje" },
  { key: "vencidos", emoji: "⚠️", label: "Vencidos" },
  { key: "proximos", emoji: "📅", label: "Próx. 3d" },
  { key: "frios", emoji: "❄️", label: "Frios +7d" },
];

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function matchesUrgency(lead: LeadCard, filter: UrgencyFilter): boolean {
  if (filter === "todos") return true;
  const isFinal =
    lead.status === "won" || lead.status === "lost" || lead.status === "disqualified";
  if (isFinal) return false;

  const today = startOfToday();
  const endToday = new Date(today.getTime() + 86400_000 - 1);
  const in3Days = new Date(today.getTime() + 3 * 86400_000);
  const ago7 = new Date(today.getTime() - 7 * 86400_000);
  const ymd = today.toISOString().slice(0, 10);

  if (filter === "hoje") {
    const nextHoje = lead.next_contact_at === ymd;
    const followHoje =
      lead.follow_up_at && new Date(lead.follow_up_at) <= endToday;
    return !!(nextHoje || followHoje);
  }
  if (filter === "vencidos") {
    return !!(lead.follow_up_at && new Date(lead.follow_up_at) < today);
  }
  if (filter === "proximos") {
    const nextProximo =
      lead.next_contact_at &&
      lead.next_contact_at > ymd &&
      new Date(lead.next_contact_at) <= in3Days;
    const followProximo =
      lead.follow_up_at &&
      new Date(lead.follow_up_at) > endToday &&
      new Date(lead.follow_up_at) <= in3Days;
    return !!(nextProximo || followProximo);
  }
  if (filter === "frios") {
    return !!(
      lead.last_message_at && new Date(lead.last_message_at) < ago7
    );
  }
  return true;
}

type Attendant = { id: string; display_name: string | null };

export function ConversationList({
  initialLeads,
  isAdmin = false,
  attendants = [],
}: {
  initialLeads: LeadCard[];
  isAdmin?: boolean;
  attendants?: Attendant[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialUrgency = (searchParams.get("filter") ?? "todos") as UrgencyFilter;
  const initialBucket = (searchParams.get("bucket") ?? "todos") as Bucket;
  const initialOwner = searchParams.get("owner") ?? "todos";

  const [leads, setLeads] = useState<LeadCard[]>(initialLeads);
  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<Bucket>(initialBucket);
  const [urgency, setUrgency] = useState<UrgencyFilter>(initialUrgency);
  const [ownerFilter, setOwnerFilter] = useState<string>(initialOwner);
  const [sheetLead, setSheetLead] = useState<LeadCard | null>(null);
  const [showNew, setShowNew] = useState(false);

  // Cascata: cada contador respeita os OUTROS filtros, ignorando só o seu próprio
  // facet. Ex: badges de "Etapa no funil" refletem o atendente/urgência atuais.
  const matchesFilters = (
    l: LeadCard,
    except: "urgency" | "bucket" | "owner" | undefined,
    q: string,
  ): boolean => {
    if (except !== "bucket" && bucket !== "todos" && bucketOf(l) !== bucket) return false;
    if (except !== "urgency" && !matchesUrgency(l, urgency)) return false;
    if (except !== "owner" && ownerFilter !== "todos") {
      if (ownerFilter === "_unassigned") {
        if (l.assigned_owner_id) return false;
      } else if (l.assigned_owner_id !== ownerFilter) {
        return false;
      }
    }
    if (q) {
      const text = `${l.name ?? ""} ${l.phone} ${l.last_message?.text ?? ""}`.toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads
      .filter((l) => matchesFilters(l, undefined, q))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return bt - at;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, search, bucket, urgency, ownerFilter]);

  const urgencyCounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = leads.filter((l) => matchesFilters(l, "urgency", q));
    const out: Record<UrgencyFilter, number> = {
      todos: base.length,
      hoje: 0,
      vencidos: 0,
      proximos: 0,
      frios: 0,
    };
    for (const l of base) {
      if (matchesUrgency(l, "hoje")) out.hoje++;
      if (matchesUrgency(l, "vencidos")) out.vencidos++;
      if (matchesUrgency(l, "proximos")) out.proximos++;
      if (matchesUrgency(l, "frios")) out.frios++;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, search, bucket, ownerFilter]);

  const counts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = leads.filter((l) => matchesFilters(l, "bucket", q));
    return countByBucket(base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, search, urgency, ownerFilter]);

  const ownerCounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = leads.filter((l) => matchesFilters(l, "owner", q));
    const out: Record<string, number> = { todos: base.length, _unassigned: 0 };
    for (const a of attendants) out[a.id] = 0;
    for (const l of base) {
      if (!l.assigned_owner_id) out._unassigned++;
      else if (out[l.assigned_owner_id] !== undefined) {
        out[l.assigned_owner_id]++;
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, search, bucket, urgency, attendants]);

  function applyPatched(updated: LeadFull) {
    setLeads((prev) =>
      prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)),
    );
  }

  async function handleSheetAction(a: LeadActionPayload) {
    if (!sheetLead) return;
    if (a.kind === "copy_phone") {
      try {
        await navigator.clipboard.writeText(sheetLead.phone);
      } catch {
        /* noop */
      }
      setSheetLead(null);
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
                  follow_up_note: a.note ?? null,
                }
              : a.kind === "next_contact"
                ? {
                    follow_up_at: a.date
                      ? new Date(`${a.date}T12:00:00`).toISOString()
                      : null,
                    follow_up_note: a.note ?? null,
                  }
                : null;
    if (!payload) return;
    try {
      const res = await fetch(`/api/leads/${sheetLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "erro");
      applyPatched(data.lead as LeadFull);
    } catch (e) {
      alert(e instanceof Error ? e.message : "erro");
    } finally {
      setSheetLead(null);
    }
  }

  return (
    <div className="relative flex-1 flex flex-col bg-white min-h-0 min-w-0 overflow-x-hidden w-full">
      <header className="md:hidden sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">
          Conversas
        </h1>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--sakura-cocoa,#3b2d28)] text-white text-[12px] font-semibold active:opacity-80"
        >
          ＋ Nova
        </button>
      </header>

      {/* Barra de urgência (Hoje / Vencidos / Próximos / Frios) */}
      <div className="bg-white">
        <p className="px-4 pt-3 pb-1.5 text-[9px] uppercase tracking-[1.5px] font-semibold text-slate-400">
          Quando chamar
        </p>
        <div className="overflow-x-auto"><div className="flex gap-2 px-3 pb-2 min-w-max">
          {URGENCY_CHIPS.map((c) => {
            const isActive = urgency === c.key;
            const count = urgencyCounts[c.key];
            return (
              <button
                key={c.key}
                onClick={() => setUrgency(c.key)}
                className="px-3 py-1.5 rounded-full transition shrink-0 text-[11px] font-semibold whitespace-nowrap flex items-center gap-1.5"
                style={{
                  background: isActive
                    ? "var(--sakura-rose-2,#a06a56)"
                    : "rgb(241 245 249)",
                  color: isActive ? "white" : "rgb(51 65 85)",
                }}
              >
                <span className="text-[14px]">{c.emoji}</span>
                {c.label}
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px]"
                  style={{
                    background: isActive
                      ? "rgba(255,255,255,0.18)"
                      : "rgb(226 232 240)",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {isAdmin && attendants.length > 0 && (
        <div className="bg-white border-t border-slate-100">
          <p className="px-4 pt-3 pb-1.5 text-[9px] uppercase tracking-[1.5px] font-semibold text-slate-400">
            Atendente
          </p>
          <div className="overflow-x-auto"><div className="flex gap-2 px-3 pb-2 min-w-max">
            {[
              { id: "todos", label: "Todas" },
              ...attendants.map((a) => ({
                id: a.id,
                label: a.display_name ?? "Sem nome",
              })),
              { id: "_unassigned", label: "Sem atendente" },
            ].map((opt) => {
              const isActive = ownerFilter === opt.id;
              const count = ownerCounts[opt.id] ?? 0;
              return (
                <button
                  key={opt.id}
                  onClick={() => setOwnerFilter(opt.id)}
                  className="px-3 py-1.5 rounded-full transition shrink-0 text-[11px] font-semibold whitespace-nowrap flex items-center gap-1.5"
                  style={{
                    background: isActive
                      ? "var(--sakura-rose-2,#a06a56)"
                      : "rgb(241 245 249)",
                    color: isActive ? "white" : "rgb(51 65 85)",
                  }}
                >
                  {opt.label}
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[10px]"
                    style={{
                      background: isActive
                        ? "rgba(255,255,255,0.18)"
                        : "rgb(226 232 240)",
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          </div>
        </div>
      )}

      <div className="bg-white border-t border-slate-100">
        <p className="px-4 pt-3 pb-1.5 text-[9px] uppercase tracking-[1.5px] font-semibold text-slate-400">
          Etapa no funil
        </p>
        <PipelineBar active={bucket} onChange={setBucket} counts={counts} />
      </div>

      <div className="px-4 py-2 border-b border-slate-100 bg-white">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar nome, telefone ou mensagem..."
          className="w-full px-3 py-2 text-sm bg-slate-100 rounded-lg outline-none focus:bg-slate-200/70 transition"
        />
      </div>

      <ul className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <li className="p-6 text-center text-sm text-slate-400">
            Nenhuma conversa nesse filtro.
          </li>
        ) : (
          filtered.map((lead) => (
            <ConversationCard
              key={lead.id}
              lead={lead}
              onPatched={applyPatched}
              onOpenSheet={(l) => setSheetLead(l)}
            />
          ))
        )}
      </ul>

      <LeadActionsSheet
        open={!!sheetLead}
        lead={sheetLead}
        onAction={handleSheetAction}
        onClose={() => setSheetLead(null)}
      />

      {/* FAB "Nova conversa" — desktop (no mobile já tem botão no header) */}
      <button
        onClick={() => setShowNew(true)}
        className="hidden md:flex absolute bottom-4 right-4 z-20 items-center gap-2 px-4 py-3 rounded-full bg-[var(--sakura-cocoa,#3b2d28)] text-white text-sm font-semibold shadow-lg hover:shadow-xl active:opacity-80"
        title="Iniciar conversa com um lead"
      >
        ＋ Nova conversa
      </button>

      {showNew && <NewConversationModal onClose={() => setShowNew(false)} />}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { LeadFull } from "../lead-modal";
import type { LastMessage } from "./load-leads";
import { ConversationCard } from "./conversation-card";
import {
  bucketOf,
  countByBucket,
  BUCKETS,
  type Bucket,
} from "./pipeline-bar";
import { LeadActionsSheet, type LeadActionPayload } from "./lead-actions-sheet";
import { NewConversationLauncher } from "./new-conversation";
import { BottomSheet } from "./bottom-sheet";

type LeadCard = LeadFull & {
  selfie_signed_url?: string | null;
  last_message: LastMessage | null;
  unread?: boolean;
};

type UrgencyFilter = "todos" | "nao_lidas" | "hoje" | "vencidos" | "proximos" | "frios";

const URGENCY_CHIPS: Array<{ key: UrgencyFilter; emoji: string; label: string }> = [
  { key: "todos", emoji: "📋", label: "Tudo" },
  { key: "nao_lidas", emoji: "🟢", label: "Não lidas" },
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
  // "Não lidas" independe de status (até um won pode ter msg nova não lida).
  if (filter === "nao_lidas") return !!lead.unread;
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
  // Qual grupo de filtro está com o sheet de opções aberto (null = fechado).
  const [openFilter, setOpenFilter] = useState<
    "urgency" | "bucket" | "owner" | null
  >(null);
  const [sheetLead, setSheetLead] = useState<LeadCard | null>(null);
  // Janela: renderiza só os primeiros N cards (cada um é motion.div pesado).
  // Sem isso, ~2k cards travam o Safari ao abrir modal / teclado.
  const [visible, setVisible] = useState(50);

  // Reseta a janela quando o filtro muda (lista nova começa do topo).
  useEffect(() => {
    setVisible(50);
  }, [search, bucket, urgency, ownerFilter]);

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
      nao_lidas: 0,
      hoje: 0,
      vencidos: 0,
      proximos: 0,
      frios: 0,
    };
    for (const l of base) {
      if (matchesUrgency(l, "nao_lidas")) out.nao_lidas++;
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

  const applyPatched = useCallback((updated: LeadFull) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)),
    );
  }, []);

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

  // Opções de atendente (admin): Todas + cada atendente + sem atendente.
  const ownerOptions = [
    { key: "todos", label: "Todas", emoji: "👥" },
    ...attendants.map((a) => ({
      key: a.id,
      label: a.display_name ?? "Sem nome",
      emoji: "👤",
    })),
    { key: "_unassigned", label: "Sem atendente", emoji: "🚫" },
  ];

  // Definição dos 3 grupos de filtro: título do sheet, valor atual, setter e
  // a lista de opções (com emoji + contagem). Indexado por openFilter.
  type FacetOption = { key: string; label: string; emoji?: string; count: number };
  const facets: Record<
    "urgency" | "bucket" | "owner",
    { title: string; value: string; onSelect: (k: string) => void; options: FacetOption[] }
  > = {
    urgency: {
      title: "Quando chamar",
      value: urgency,
      onSelect: (k) => setUrgency(k as UrgencyFilter),
      options: URGENCY_CHIPS.map((c) => ({
        key: c.key,
        label: c.label,
        emoji: c.emoji,
        count: urgencyCounts[c.key] ?? 0,
      })),
    },
    bucket: {
      title: "Etapa no funil",
      value: bucket,
      onSelect: (k) => setBucket(k as Bucket),
      options: BUCKETS.map((b) => ({
        key: b.key,
        label: b.label,
        emoji: b.emoji,
        count: counts[b.key] ?? 0,
      })),
    },
    owner: {
      title: "Atendente",
      value: ownerFilter,
      onSelect: (k) => setOwnerFilter(k),
      options: ownerOptions.map((o) => ({ ...o, count: ownerCounts[o.key] ?? 0 })),
    },
  };

  // Gatilhos (ícones) da linha única. Cada um mostra o emoji + a seleção atual
  // (ou o nome do grupo, quando no default "todos"). "owner" só pra admin.
  const triggers: Array<{
    key: "urgency" | "bucket" | "owner";
    emoji: string;
    label: string;
    active: boolean;
    selLabel?: string;
  }> = [
    {
      key: "urgency",
      emoji: "⏰",
      label: "Quando",
      active: urgency !== "todos",
      selLabel: URGENCY_CHIPS.find((c) => c.key === urgency)?.label,
    },
    {
      key: "bucket",
      emoji: "📊",
      label: "Funil",
      active: bucket !== "todos",
      selLabel: BUCKETS.find((b) => b.key === bucket)?.label,
    },
    ...(isAdmin && attendants.length > 0
      ? [
          {
            key: "owner" as const,
            emoji: "👤",
            label: "Atendente",
            active: ownerFilter !== "todos",
            selLabel: ownerOptions.find((o) => o.key === ownerFilter)?.label,
          },
        ]
      : []),
  ];

  const openFacet = openFilter ? facets[openFilter] : null;

  return (
    <div className="relative flex-1 flex flex-col bg-white min-h-0 min-w-0 overflow-x-hidden w-full">
      <header className="md:hidden sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">
          Conversas
        </h1>
        <NewConversationLauncher variant="header" />
      </header>

      {/* Filtros compactos: 1 ícone por grupo, toca pra abrir as opções */}
      <div className="bg-white border-b border-slate-100 flex items-center gap-2 px-3 py-2 overflow-x-auto no-scrollbar">
        {triggers.map((t) => (
          <button
            key={t.key}
            onClick={() => setOpenFilter(t.key)}
            className="shrink-0 flex flex-col items-start px-3 py-1.5 rounded-xl transition"
            style={{
              background: t.active
                ? "var(--sakura-rose-2,#a06a56)"
                : "rgb(241 245 249)",
              color: t.active ? "white" : "rgb(51 65 85)",
            }}
          >
            <span className="text-[9px] uppercase tracking-wide font-semibold opacity-60 leading-none">
              {t.label}
            </span>
            <span className="flex items-center gap-1 mt-0.5 leading-tight">
              <span className="text-[13px]">{t.emoji}</span>
              <span className="max-w-[110px] truncate text-[12px] font-semibold">
                {t.selLabel ?? t.label}
              </span>
              <span className="text-[8px] opacity-60">▾</span>
            </span>
          </button>
        ))}
      </div>

      <BottomSheet open={openFilter !== null} onClose={() => setOpenFilter(null)}>
        {openFacet && (
          <div className="px-3 pb-4">
            <h3 className="px-2 pb-2 text-base font-semibold text-slate-900">
              {openFacet.title}
            </h3>
            <div className="flex flex-col gap-0.5">
              {openFacet.options.map((o) => {
                const isActive = o.key === openFacet.value;
                return (
                  <button
                    key={o.key}
                    onClick={() => {
                      openFacet.onSelect(o.key);
                      setOpenFilter(null);
                    }}
                    className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl text-left transition active:bg-slate-100"
                    style={{
                      background: isActive
                        ? "var(--sakura-cream,#fbf6ee)"
                        : "transparent",
                    }}
                  >
                    <span className="flex items-center gap-2.5 text-[15px] font-medium text-slate-800">
                      {o.emoji && <span className="text-[18px]">{o.emoji}</span>}
                      {o.label}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-[13px] text-slate-400">{o.count}</span>
                      {isActive && (
                        <span
                          className="font-bold"
                          style={{ color: "var(--sakura-rose-2,#a06a56)" }}
                        >
                          ✓
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </BottomSheet>

      <div className="px-4 py-2 border-b border-slate-100 bg-white">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar nome, telefone ou mensagem..."
          className="w-full px-3 py-2 text-sm bg-slate-100 rounded-lg outline-none focus:bg-slate-200/70 transition"
        />
      </div>

      <ul
        className="flex-1 overflow-y-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (
            el.scrollHeight - el.scrollTop - el.clientHeight < 600 &&
            visible < filtered.length
          ) {
            setVisible((v) => v + 50);
          }
        }}
      >
        {filtered.length === 0 ? (
          <li className="p-6 text-center text-sm text-slate-400">
            Nenhuma conversa nesse filtro.
          </li>
        ) : (
          filtered.slice(0, visible).map((lead) => (
            <ConversationCard
              key={lead.id}
              lead={lead}
              onPatched={applyPatched}
              onOpenSheet={setSheetLead}
            />
          ))
        )}
        {visible < filtered.length && (
          <li className="py-4 text-center text-xs text-slate-400">
            mostrando {visible} de {filtered.length} · role pra ver mais
          </li>
        )}
      </ul>

      <LeadActionsSheet
        open={!!sheetLead}
        lead={sheetLead}
        onAction={handleSheetAction}
        onClose={() => setSheetLead(null)}
      />

      {/* FAB "Nova conversa" — desktop (no mobile já tem botão no header) */}
      <NewConversationLauncher variant="fab" />
    </div>
  );
}

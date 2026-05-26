"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ARCH_BADGE,
  ARCH_LABEL,
  LeadModal,
  STATUS_BADGE,
  STATUS_LABEL,
  STATUS_OPTIONS,
  fmtBRL,
  whatsLink,
  type LeadFull,
} from "../lead-modal";

export type PipelineLead = LeadFull;
export type CrmUser = { id: string; display_name: string; role: string };

const ARCH_OPTIONS = ["all", "PRONTA", "ESPERANCOSA", "CETICA"] as const;
const STATUS_FILTER_OPTIONS = ["all", ...STATUS_OPTIONS] as const;

const DATE_OPTIONS = ["all", "today", "yesterday", "7d", "30d", "90d"] as const;
type DatePreset = (typeof DATE_OPTIONS)[number];
const DATE_LABELS: Record<DatePreset, string> = {
  all: "Tudo",
  today: "Hoje",
  yesterday: "Ontem",
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
};

// Filtro por created_at do lead, comparando em horário local (browser).
function inDateRange(createdAt: string, preset: DatePreset): boolean {
  if (preset === "all") return true;
  const t = new Date(createdAt).getTime();
  const now = new Date();
  if (preset === "today") {
    const s = new Date(now);
    s.setHours(0, 0, 0, 0);
    return t >= s.getTime();
  }
  if (preset === "yesterday") {
    const s = new Date(now);
    s.setDate(s.getDate() - 1);
    s.setHours(0, 0, 0, 0);
    const e = new Date(s);
    e.setDate(e.getDate() + 1);
    return t >= s.getTime() && t < e.getTime();
  }
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  return t >= now.getTime() - days * 86_400_000;
}

// Origem unificada: granular o suficiente pra filtrar sem precisar de uma
// linha extra "variant do quiz". quiz-resina/quiz-porcelana viram opções
// próprias. WhatsApp = lead que entrou via webhook (source=NULL).
const ORIGIN_OPTIONS = [
  "all",
  "quiz_resina",
  "quiz_porcelana",
  "whatsapp",
  "kiwify",
  "vendas",
  "outros",
] as const;
type OriginGroup = (typeof ORIGIN_OPTIONS)[number];

const ORIGIN_LABELS: Record<OriginGroup, string> = {
  all: "Todas",
  quiz_resina: "Quiz·Resina",
  quiz_porcelana: "Quiz·Porcelana",
  whatsapp: "WhatsApp",
  kiwify: "Kiwify",
  vendas: "Página de vendas",
  outros: "Outros",
};

// Badge curto pra coluna da tabela (compacto, sem quebrar linha)
const ORIGIN_BADGE: Record<Exclude<OriginGroup, "all">, string> = {
  quiz_resina: "bg-amber-100 text-amber-800",
  quiz_porcelana: "bg-sky-100 text-sky-800",
  whatsapp: "bg-emerald-100 text-emerald-800",
  kiwify: "bg-violet-100 text-violet-800",
  vendas: "bg-rose-100 text-rose-800",
  outros: "bg-slate-100 text-slate-600",
};

function originGroupOf(
  source: string | null | undefined,
  quizVariant: string | null | undefined,
): OriginGroup {
  const s = (source ?? "").toLowerCase();
  if (s === "quiz") {
    if (quizVariant === "resina") return "quiz_resina";
    if (quizVariant === "porcelana") return "quiz_porcelana";
    return "outros";
  }
  if (s === "kiwify" || s.startsWith("kiwify")) return "kiwify";
  if (s === "vlr-pagina-venda" || s.startsWith("lp-") || s.startsWith("vlr-")) {
    return "vendas";
  }
  // Sem source explícito = chegou via webhook do WhatsApp (anúncio Meta → WPP direto)
  if (!source) return "whatsapp";
  return "outros";
}

// ============================================================
// Componente principal
// ============================================================

export function PipelineView({
  initialLeads,
  users = [],
  isAdmin = false,
}: {
  initialLeads: PipelineLead[];
  users?: CrmUser[];
  isAdmin?: boolean;
}) {
  const usersById = useMemo(() => {
    const map: Record<string, CrmUser> = {};
    for (const u of users) map[u.id] = u;
    return map;
  }, [users]);
  // Atendentes filtráveis: apenas role='sales' (Ju/admin não atende, agrupa)
  const salesUsers = useMemo(() => users.filter((u) => u.role === "sales"), [users]);
  const [filterOwner, setFilterOwner] = useState<"all" | string>("all");
  const supabase = createClient();
  const [leads, setLeads] = useState<PipelineLead[]>(initialLeads);
  const [editing, setEditing] = useState<PipelineLead | null>(null);
  const [search, setSearch] = useState("");
  const [filterArch, setFilterArch] = useState<(typeof ARCH_OPTIONS)[number]>("all");
  const [filterStatus, setFilterStatus] =
    useState<(typeof STATUS_FILTER_OPTIONS)[number]>("all");
  const [filterOrigin, setFilterOrigin] = useState<OriginGroup>("all");
  const [filterDate, setFilterDate] = useState<DatePreset>("all");

  // Inline save: PATCH /api/leads/[id] e otimista local
  const patchLead = useCallback(
    async (
      leadId: string,
      changes: Record<string, unknown>,
      rollback: () => void,
    ) => {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!res.ok) {
        rollback();
        const data = await res.json().catch(() => ({}));
        alert(`Erro ao salvar: ${data.error ?? res.statusText}`);
      }
    },
    [],
  );

  const updateStatus = useCallback(
    (leadId: string, newStatus: string) => {
      const prev = leads.find((l) => l.id === leadId)?.status ?? null;
      setLeads((cur) =>
        cur.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)),
      );
      patchLead(leadId, { status: newStatus }, () => {
        setLeads((cur) =>
          cur.map((l) => (l.id === leadId ? { ...l, status: prev } : l)),
        );
      });
    },
    [leads, patchLead],
  );

  const updateOwner = useCallback(
    (leadId: string, newOwnerId: string | null) => {
      const prev = leads.find((l) => l.id === leadId)?.assigned_owner_id ?? null;
      setLeads((cur) =>
        cur.map((l) =>
          l.id === leadId ? { ...l, assigned_owner_id: newOwnerId } : l,
        ),
      );
      patchLead(leadId, { assigned_owner_id: newOwnerId }, () => {
        setLeads((cur) =>
          cur.map((l) =>
            l.id === leadId ? { ...l, assigned_owner_id: prev } : l,
          ),
        );
      });
    },
    [leads, patchLead],
  );

  // Realtime sync
  useEffect(() => {
    const ch = supabase
      .channel("leads-pipeline")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setLeads((prev) => [payload.new as PipelineLead, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setLeads((prev) =>
              prev.map((l) =>
                l.id === (payload.new as PipelineLead).id
                  ? (payload.new as PipelineLead)
                  : l,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            setLeads((prev) => prev.filter((l) => l.id !== (payload.old as PipelineLead).id));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    const archOrder: Record<string, number> = { PRONTA: 0, ESPERANCOSA: 1, CETICA: 2 };
    return leads
      .filter((l) => {
        if (filterArch !== "all" && l.archetype !== filterArch) return false;
        if (
          filterOrigin !== "all" &&
          originGroupOf(l.source, l.quiz_variant) !== filterOrigin
        ) {
          return false;
        }
        if (filterStatus !== "all" && (l.status ?? "new") !== filterStatus) return false;
        if (filterOwner !== "all" && l.assigned_owner_id !== filterOwner) return false;
        if (!inDateRange(l.created_at, filterDate)) return false;
        if (search) {
          const t = search.toLowerCase();
          if (
            !(l.name ?? "").toLowerCase().includes(t) &&
            !l.phone.includes(t)
          )
            return false;
        }
        return true;
      })
      .sort((a, b) => {
        const ao = archOrder[a.archetype ?? "ZZ"] ?? 99;
        const bo = archOrder[b.archetype ?? "ZZ"] ?? 99;
        if (ao !== bo) return ao - bo;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [leads, search, filterArch, filterStatus, filterOwner, filterOrigin, filterDate]);

  // Contagem por preset de data (pra mostrar (n) em cada pill)
  const countByDate = useMemo(() => {
    const map: Record<DatePreset, number> = {
      all: 0, today: 0, yesterday: 0, "7d": 0, "30d": 0, "90d": 0,
    };
    for (const l of leads) {
      for (const p of DATE_OPTIONS) {
        if (inDateRange(l.created_at, p)) map[p]++;
      }
    }
    return map;
  }, [leads]);

  // Contagem por status (pra pills de filtro)
  const countByStatus = useMemo(() => {
    const map: Record<string, number> = { all: leads.length };
    STATUS_OPTIONS.forEach((s) => {
      map[s] = leads.filter((l) => (l.status ?? "new") === s).length;
    });
    return map;
  }, [leads]);

  // Contagem por origem (já granular — inclui quiz_resina, quiz_porcelana,
  // whatsapp, etc — então não precisa mais de um countByVariant separado).
  const countByOrigin = useMemo(() => {
    const map: Record<OriginGroup, number> = {
      all: leads.length,
      quiz_resina: 0,
      quiz_porcelana: 0,
      whatsapp: 0,
      kiwify: 0,
      vendas: 0,
      outros: 0,
    };
    leads.forEach((l) => {
      const g = originGroupOf(l.source, l.quiz_variant);
      map[g] = (map[g] ?? 0) + 1;
    });
    return map;
  }, [leads]);

  // Métricas
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const monthStr = new Date().toISOString().slice(0, 7);
    const novosHoje = leads.filter((l) => l.created_at.slice(0, 10) === todayStr).length;
    const prontasNovas = leads.filter(
      (l) => l.archetype === "PRONTA" && (l.status ?? "new") === "new",
    ).length;
    const negociacao = leads.filter((l) =>
      ["contacted", "qualified", "proposal"].includes(l.status ?? "new"),
    ).length;
    const fechadosMes = leads.filter(
      (l) => l.status === "won" && l.updated_at.slice(0, 7) === monthStr,
    );
    const receitaMes = fechadosMes.reduce(
      (s, l) => s + Number(l.deal_value ?? 0),
      0,
    );
    return {
      novosHoje,
      prontasNovas,
      negociacao,
      fechadosMes: fechadosMes.length,
      receitaMes,
    };
  }, [leads]);

  return (
    <div className="max-w-[1280px] mx-auto px-5 lg:px-8 py-6 w-full">
      {/* Header da view */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Pipeline</h2>
          <p className="text-sm text-slate-500">
            {leads.length} leads · gestão de funil
          </p>
        </div>
        <button
          onClick={exportCsv(leads)}
          className="px-3 py-2 text-sm rounded-md bg-white border border-slate-200 hover:border-slate-400"
        >
          📤 Exportar CSV
        </button>
      </div>

      {/* Métricas */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <Stat label="Leads novos hoje" value={stats.novosHoje} />
        <Stat label="Prontos pendentes" value={stats.prontasNovas} accent="green" />
        <Stat label="Em negociação" value={stats.negociacao} accent="amber" />
        <Stat label="Fechados no mês" value={stats.fechadosMes} accent="emerald" />
        <Stat
          label="Receita do mês"
          value={fmtBRL(stats.receitaMes)}
          isText
          className="col-span-2 lg:col-span-1"
        />
      </section>

      {/* Filtros */}
      <section className="bg-white border border-slate-200 rounded-md p-3 mb-3 flex flex-col md:flex-row md:flex-wrap md:items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Buscar por nome ou WhatsApp"
          className="w-full md:flex-1 md:min-w-[200px] px-3 py-2.5 md:py-2 text-base md:text-sm border border-slate-200 rounded-md outline-none focus:border-slate-900"
        />
        <div className="-mx-3 md:mx-0 px-3 md:px-0 overflow-x-auto md:overflow-visible">
          <div className="flex gap-1 md:flex-wrap whitespace-nowrap">
            {ARCH_OPTIONS.map((a) => (
              <button
                key={a}
                onClick={() => setFilterArch(a)}
                className={`flex-shrink-0 px-3 py-2 md:py-1.5 text-xs rounded-md border transition ${
                  filterArch === a
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                }`}
              >
                {a === "all" ? "Todos" : ARCH_LABEL[a as keyof typeof ARCH_LABEL]}
              </button>
            ))}
          </div>
        </div>
        {isAdmin && salesUsers.length > 0 && (
          <select
            value={filterOwner}
            onChange={(e) => setFilterOwner(e.target.value)}
            className="w-full md:w-auto px-3 py-2.5 md:py-2 text-base md:text-sm border border-slate-200 rounded-md outline-none"
          >
            <option value="all">Todas as atendentes</option>
            {salesUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name}
              </option>
            ))}
          </select>
        )}
      </section>

      {/* Aba de origem: pills com contagem */}
      <div className="-mx-5 lg:-mx-8 md:mx-0 px-5 lg:px-8 md:px-0 mb-2 overflow-x-auto md:overflow-visible">
        <div className="flex items-center gap-2 md:flex-wrap whitespace-nowrap">
          <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold mr-1 flex-shrink-0 hidden md:inline">
            Origem:
          </span>
          {ORIGIN_OPTIONS.map((g) => (
            <button
              key={g}
              onClick={() => setFilterOrigin(g)}
              className={`flex-shrink-0 px-3 py-2 md:py-1.5 rounded-full text-xs md:text-[12px] font-semibold transition ${
                filterOrigin === g
                  ? "bg-amber-600 text-white"
                  : "bg-white text-slate-700 ring-1 ring-slate-300 hover:ring-slate-400"
              }`}
            >
              {ORIGIN_LABELS[g]}{" "}
              <span className="opacity-70 ml-1">({countByOrigin[g] ?? 0})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Aba de data: filtro por created_at do lead (presets) */}
      <div className="-mx-5 lg:-mx-8 md:mx-0 px-5 lg:px-8 md:px-0 mb-2 overflow-x-auto md:overflow-visible">
        <div className="flex items-center gap-2 md:flex-wrap whitespace-nowrap">
          <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold mr-1 flex-shrink-0 hidden md:inline">
            Data:
          </span>
          {DATE_OPTIONS.map((p) => (
            <button
              key={p}
              onClick={() => setFilterDate(p)}
              className={`flex-shrink-0 px-3 py-2 md:py-1.5 rounded-full text-xs md:text-[12px] font-semibold transition ${
                filterDate === p
                  ? "bg-sky-600 text-white"
                  : "bg-white text-slate-700 ring-1 ring-slate-300 hover:ring-slate-400"
              }`}
            >
              {DATE_LABELS[p]}{" "}
              <span className="opacity-70 ml-1">({countByDate[p]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Aba de status: pills com contagem (clica e filtra) */}
      <div className="-mx-5 lg:-mx-8 md:mx-0 px-5 lg:px-8 md:px-0 mb-3 overflow-x-auto md:overflow-visible">
        <div className="flex items-center gap-2 md:flex-wrap whitespace-nowrap">
          <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold mr-1 flex-shrink-0 hidden md:inline">
            Status:
          </span>
          <button
            onClick={() => setFilterStatus("all")}
            className={`flex-shrink-0 px-3 py-2 md:py-1.5 rounded-full text-xs md:text-[12px] font-semibold transition ${
              filterStatus === "all"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-300"
            }`}
          >
            Todos <span className="opacity-70 ml-1">({countByStatus.all})</span>
          </button>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`flex-shrink-0 px-3 py-2 md:py-1.5 rounded-full text-xs md:text-[12px] font-semibold transition ring-1 ${
                filterStatus === s
                  ? `${STATUS_BADGE[s]} ring-current`
                  : "bg-white text-slate-700 ring-slate-300 hover:ring-slate-400"
              }`}
            >
              {STATUS_LABEL[s]}{" "}
              <span className="opacity-70 ml-1">({countByStatus[s] ?? 0})</span>
            </button>
          ))}
        </div>
      </div>

      {/* ============ MOBILE: lista em cards ============ */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-md border border-slate-200 p-8 text-center text-sm text-slate-500">
            Nenhum lead com esse filtro.
          </div>
        ) : (
          filtered.map((l) => {
            const ownerLabel = l.assigned_owner_id
              ? usersById[l.assigned_owner_id]?.display_name
              : l.assigned_to;
            return (
              <div
                key={l.id}
                role="button"
                tabIndex={0}
                onClick={() => setEditing(l)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setEditing(l);
                  }
                }}
                className="w-full text-left bg-white rounded-md border border-slate-200 p-3 active:bg-slate-50 transition flex flex-col gap-2 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    {l.selfie_signed_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={l.selfie_signed_url}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-[15px] leading-tight truncate">
                        {l.name ?? (
                          <span className="text-slate-400 italic">sem nome</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {l.phone}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {fmtEntrada(l.created_at)}
                        {l.geo ? ` · ${l.geo}` : ""}
                        {l.deal_value
                          ? ` · ${fmtBRL(Number(l.deal_value))}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <select
                    value={l.status ?? "new"}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateStatus(l.id, e.target.value);
                    }}
                    aria-label="Status"
                    className={`flex-shrink-0 px-2 py-1 rounded-full text-[10px] font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400 ${STATUS_BADGE[l.status ?? "new"]}`}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                    {l.archetype && (
                      <span
                        className={`flex-shrink-0 whitespace-nowrap px-2 py-1 rounded-full text-[10px] font-semibold ${ARCH_BADGE[l.archetype]}`}
                      >
                        {ARCH_LABEL[l.archetype]}
                      </span>
                    )}
                    {(() => {
                      const og = originGroupOf(l.source, l.quiz_variant);
                      if (og === "all") return null;
                      return (
                        <span
                          className={`flex-shrink-0 whitespace-nowrap px-2 py-1 rounded-full text-[10px] font-semibold ${ORIGIN_BADGE[og]}`}
                        >
                          {ORIGIN_LABELS[og]}
                        </span>
                      );
                    })()}
                    {ownerLabel && (
                      <span className="text-[11px] text-slate-500 truncate">
                        👤 {ownerLabel}
                      </span>
                    )}
                  </div>
                  <a
                    href={whatsLink(l.phone, l.name)}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`WhatsApp de ${l.name ?? l.phone}`}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-full text-xs font-semibold transition"
                  >
                    <svg
                      viewBox="0 0 32 32"
                      fill="currentColor"
                      className="w-3.5 h-3.5"
                      aria-hidden="true"
                    >
                      <path d="M16.003 3C9.376 3 4 8.376 4 15c0 2.353.689 4.546 1.873 6.405L4 28l6.764-1.834A12 12 0 0 0 16.003 27C22.63 27 28 21.624 28 15S22.63 3 16.003 3zm5.27 14.395c-.288-.144-1.704-.84-1.968-.936-.264-.096-.456-.144-.648.144-.192.288-.744.936-.912 1.128-.168.192-.336.216-.624.072-.288-.144-1.218-.45-2.32-1.43-.858-.765-1.437-1.71-1.605-1.998-.168-.288-.018-.443.126-.587.13-.13.288-.336.432-.504.144-.168.192-.288.288-.48.096-.192.048-.36-.024-.504-.072-.144-.648-1.56-.888-2.136-.234-.561-.471-.485-.648-.494-.168-.008-.36-.01-.552-.01s-.504.072-.768.36c-.264.288-1.008.984-1.008 2.4 0 1.416 1.032 2.784 1.176 2.976.144.192 2.032 3.103 4.92 4.354.688.297 1.224.475 1.642.608.69.219 1.318.188 1.814.114.553-.083 1.704-.696 1.944-1.368.24-.672.24-1.248.168-1.368-.072-.12-.264-.192-.552-.336z" />
                    </svg>
                    WhatsApp
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ============ DESKTOP: tabela ============ */}
      <section className="hidden md:block bg-white border border-slate-200 rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <Th>Nome</Th>
                <Th>Entrada</Th>
                <Th className="hidden md:table-cell">Telefone</Th>
                <Th>Arquétipo</Th>
                <Th className="hidden lg:table-cell">Origem</Th>
                <Th className="hidden md:table-cell">Geo</Th>
                <Th>Status</Th>
                <Th className="hidden lg:table-cell">Próx. contato</Th>
                <Th className="hidden lg:table-cell">Responsável</Th>
                <Th className="hidden md:table-cell">Valor</Th>
                <Th className="text-center">Ação</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center py-16 text-slate-400">
                    <p className="font-semibold">Nenhum lead com esse filtro.</p>
                  </td>
                </tr>
              )}
              {filtered.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => setEditing(l)}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-3 py-3 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      {l.selfie_signed_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={l.selfie_signed_url}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 shrink-0" />
                      )}
                      <span>{l.name ?? "·"}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                    {fmtEntrada(l.created_at)}
                  </td>
                  <td className="px-3 py-3 text-slate-600 hidden md:table-cell">
                    {l.phone}
                  </td>
                  <td className="px-3 py-3">
                    {l.archetype && (
                      <span
                        className={`whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-semibold ${ARCH_BADGE[l.archetype]}`}
                      >
                        {ARCH_LABEL[l.archetype]}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 hidden lg:table-cell whitespace-nowrap">
                    {(() => {
                      const og = originGroupOf(l.source, l.quiz_variant);
                      if (og === "all") return null;
                      return (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${ORIGIN_BADGE[og]}`}
                        >
                          {ORIGIN_LABELS[og]}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell text-slate-600">
                    {l.geo ?? "·"}
                  </td>
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={l.status ?? "new"}
                      onChange={(e) => updateStatus(l.id, e.target.value)}
                      aria-label={`Status de ${l.name ?? l.phone}`}
                      className={`text-[11px] font-semibold rounded-full px-2.5 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400 ${STATUS_BADGE[l.status ?? "new"]}`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3 hidden lg:table-cell text-slate-600 whitespace-nowrap">
                    {fmtDateBR(l.next_contact_at)}
                  </td>
                  <td
                    className="px-3 py-3 hidden lg:table-cell"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isAdmin && salesUsers.length > 0 ? (
                      <select
                        value={l.assigned_owner_id ?? ""}
                        onChange={(e) =>
                          updateOwner(l.id, e.target.value || null)
                        }
                        aria-label={`Responsável por ${l.name ?? l.phone}`}
                        className={`text-[11px] font-semibold rounded-full px-2.5 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400 ${
                          l.assigned_owner_id
                            ? "bg-sky-100 text-sky-900"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <option value="">sem dono</option>
                        {salesUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.display_name}
                          </option>
                        ))}
                      </select>
                    ) : l.assigned_owner_id ? (
                      <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-900">
                        {usersById[l.assigned_owner_id]?.display_name ?? "."}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">sem dono</span>
                    )}
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell text-slate-600">
                    {l.deal_value ? fmtBRL(Number(l.deal_value)) : "·"}
                  </td>
                  <td
                    className="px-3 py-3 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a
                      href={whatsLink(l.phone, l.name)}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={`Abrir WhatsApp de ${l.name ?? l.phone}`}
                      title={`WhatsApp ${l.phone}`}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white transition shadow-sm hover:shadow"
                    >
                      <svg
                        viewBox="0 0 32 32"
                        fill="currentColor"
                        className="w-4 h-4"
                        aria-hidden="true"
                      >
                        <path d="M16.003 3C9.376 3 4 8.376 4 15c0 2.353.689 4.546 1.873 6.405L4 28l6.764-1.834A12 12 0 0 0 16.003 27C22.63 27 28 21.624 28 15S22.63 3 16.003 3zm0 21.6a9.59 9.59 0 0 1-4.886-1.337l-.35-.21-3.965 1.076 1.06-3.872-.227-.367A9.6 9.6 0 1 1 25.6 15c0 5.293-4.305 9.6-9.597 9.6zm5.27-7.205c-.288-.144-1.704-.84-1.968-.936-.264-.096-.456-.144-.648.144-.192.288-.744.936-.912 1.128-.168.192-.336.216-.624.072-.288-.144-1.218-.45-2.32-1.43-.858-.765-1.437-1.71-1.605-1.998-.168-.288-.018-.443.126-.587.13-.13.288-.336.432-.504.144-.168.192-.288.288-.48.096-.192.048-.36-.024-.504-.072-.144-.648-1.56-.888-2.136-.234-.561-.471-.485-.648-.494-.168-.008-.36-.01-.552-.01s-.504.072-.768.36c-.264.288-1.008.984-1.008 2.4 0 1.416 1.032 2.784 1.176 2.976.144.192 2.032 3.103 4.92 4.354.688.297 1.224.475 1.642.608.69.219 1.318.188 1.814.114.553-.083 1.704-.696 1.944-1.368.24-.672.24-1.248.168-1.368-.072-.12-.264-.192-.552-.336z" />
                      </svg>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <LeadModal
          lead={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setLeads((prev) =>
              prev.map((l) => (l.id === updated.id ? updated : l)),
            );
            setEditing(updated);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function Stat({
  label,
  value,
  accent,
  className,
  isText,
}: {
  label: string;
  value: string | number;
  accent?: "green" | "amber" | "emerald";
  className?: string;
  isText?: boolean;
}) {
  const accentColor =
    accent === "green"
      ? "text-green-600"
      : accent === "amber"
        ? "text-amber-600"
        : accent === "emerald"
          ? "text-emerald-700"
          : "text-slate-900";
  return (
    <div
      className={`bg-white border border-slate-200 rounded-md px-4 py-3 ${className ?? ""}`}
    >
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">
        {label}
      </p>
      <p
        className={`font-bold ${accentColor} ${isText ? "text-xl" : "text-2xl"}`}
      >
        {value}
      </p>
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-2 text-left font-semibold border-b border-slate-200 ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function fmtDateBR(iso: string | null): string {
  if (!iso) return "·";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function fmtEntrada(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (d.toDateString() === today.toDateString()) return `Hoje · ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Ontem · ${time}`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + ` · ${time}`;
}

function exportCsv(leads: PipelineLead[]) {
  return () => {
    const headers = [
      "name",
      "phone",
      "instagram",
      "archetype",
      "quiz_variant",
      "geo",
      "case_type",
      "status",
      "assigned_to",
      "next_contact_at",
      "deal_value",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "created_at",
    ];
    const rows = leads.map((l) =>
      [
        csvEscape(l.name),
        csvEscape(l.phone),
        csvEscape(l.instagram),
        l.archetype ?? "",
        l.quiz_variant ?? "",
        l.geo ?? "",
        csvEscape(l.case_type),
        l.status ?? "",
        csvEscape(l.assigned_to),
        l.next_contact_at ?? "",
        l.deal_value ?? "",
        csvEscape(l.utm_source),
        csvEscape(l.utm_medium),
        csvEscape(l.utm_campaign),
        csvEscape(l.utm_term),
        csvEscape(l.utm_content),
        l.created_at,
      ].join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crm-sakura-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
}

function csvEscape(v: string | null | undefined): string {
  if (!v) return "";
  return `"${v.replace(/"/g, '""')}"`;
}

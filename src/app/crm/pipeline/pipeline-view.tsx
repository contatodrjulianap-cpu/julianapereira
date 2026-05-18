"use client";

import { useEffect, useMemo, useState } from "react";
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
        if (filterStatus !== "all" && (l.status ?? "new") !== filterStatus) return false;
        if (filterOwner !== "all" && l.assigned_owner_id !== filterOwner) return false;
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
  }, [leads, search, filterArch, filterStatus, filterOwner]);

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
        <Stat label="Prontas pendentes" value={stats.prontasNovas} accent="green" />
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
      <section className="bg-white border border-slate-200 rounded-md p-3 mb-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Buscar por nome ou WhatsApp"
          className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-slate-200 rounded-md outline-none focus:border-slate-900"
        />
        <div className="flex gap-1 flex-wrap">
          {ARCH_OPTIONS.map((a) => (
            <button
              key={a}
              onClick={() => setFilterArch(a)}
              className={`px-3 py-1.5 text-xs rounded-md border transition ${
                filterArch === a
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
              }`}
            >
              {a === "all" ? "Todos" : ARCH_LABEL[a as keyof typeof ARCH_LABEL]}
            </button>
          ))}
        </div>
        <select
          value={filterStatus}
          onChange={(e) =>
            setFilterStatus(e.target.value as (typeof STATUS_FILTER_OPTIONS)[number])
          }
          className="px-3 py-2 text-sm border border-slate-200 rounded-md outline-none"
        >
          <option value="all">Todos os status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {isAdmin && salesUsers.length > 0 && (
          <select
            value={filterOwner}
            onChange={(e) => setFilterOwner(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-md outline-none"
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

      {/* Tabela */}
      <section className="bg-white border border-slate-200 rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <Th>Nome</Th>
                <Th>Entrada</Th>
                <Th className="hidden md:table-cell">WhatsApp</Th>
                <Th>Arquétipo</Th>
                <Th className="hidden md:table-cell">Geo</Th>
                <Th>Status</Th>
                <Th className="hidden lg:table-cell">Próx. contato</Th>
                <Th className="hidden lg:table-cell">Responsável</Th>
                <Th className="hidden md:table-cell">Valor</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-slate-400">
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
                    {l.name ?? "—"}
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
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${ARCH_BADGE[l.archetype]}`}
                      >
                        {ARCH_LABEL[l.archetype]}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell text-slate-600">
                    {l.geo ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_BADGE[l.status ?? "new"]}`}
                    >
                      {STATUS_LABEL[l.status ?? "new"]}
                    </span>
                  </td>
                  <td className="px-3 py-3 hidden lg:table-cell text-slate-600 whitespace-nowrap">
                    {fmtDateBR(l.next_contact_at)}
                  </td>
                  <td className="px-3 py-3 hidden lg:table-cell text-slate-600">
                    {l.assigned_owner_id
                      ? (usersById[l.assigned_owner_id]?.display_name ?? "—")
                      : (l.assigned_to ?? "—")}
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell text-slate-600">
                    {l.deal_value ? fmtBRL(Number(l.deal_value)) : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <a
                      href={whatsLink(l.phone, l.name)}
                      target="_blank"
                      rel="noreferrer noopener"
                      onClick={(e) => e.stopPropagation()}
                      className="text-green-600 hover:underline font-bold"
                      title="Abrir WhatsApp"
                    >
                      💬
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
  if (!iso) return "—";
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

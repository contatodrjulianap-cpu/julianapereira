"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// ============================================================
// Tipos + tabelas auxiliares
// ============================================================

export type PipelineLead = {
  id: string;
  name: string | null;
  phone: string;
  instagram: string | null;
  source: string | null;
  archetype: "PRONTA" | "ESPERANCOSA" | "CETICA" | null;
  geo: "SP" | "BR" | "INTL" | null;
  case_type: string | null;
  status: string | null; // 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost'
  tags: string[];
  notes: string | null;
  notes_log: NoteEntry[] | null;
  assigned_to: string | null;
  next_contact_at: string | null;
  deal_value: number | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NoteEntry = { at: string; by: string; text: string };

const ARCH_LABEL: Record<NonNullable<PipelineLead["archetype"]>, string> = {
  PRONTA: "🔥 Pronta",
  ESPERANCOSA: "🟡 Esperançosa",
  CETICA: "📍 Cética",
};

const ARCH_BADGE: Record<NonNullable<PipelineLead["archetype"]>, string> = {
  PRONTA: "bg-green-100 text-green-800",
  ESPERANCOSA: "bg-amber-100 text-amber-800",
  CETICA: "bg-slate-200 text-slate-700",
};

const STATUS_LABEL: Record<string, string> = {
  new: "📨 Novo",
  contacted: "📞 Contatado",
  qualified: "✅ Qualificado",
  proposal: "💰 Proposta",
  won: "🎉 Fechado",
  lost: "❌ Perdido",
};

const STATUS_BADGE: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-indigo-100 text-indigo-800",
  qualified: "bg-amber-100 text-amber-800",
  proposal: "bg-pink-100 text-pink-800",
  won: "bg-emerald-100 text-emerald-800",
  lost: "bg-red-100 text-red-800",
};

const STATUS_OPTIONS = ["new", "contacted", "qualified", "proposal", "won", "lost"];
const ARCH_OPTIONS = ["all", "PRONTA", "ESPERANCOSA", "CETICA"] as const;
const STATUS_FILTER_OPTIONS = ["all", ...STATUS_OPTIONS] as const;

// ============================================================
// Componente principal
// ============================================================

export function PipelineView({ initialLeads }: { initialLeads: PipelineLead[] }) {
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
  }, [leads, search, filterArch, filterStatus]);

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
                    {l.assigned_to ?? "—"}
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
        <EditModal
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
// Edit modal
// ============================================================

function EditModal({
  lead,
  onClose,
  onSaved,
}: {
  lead: PipelineLead;
  onClose: () => void;
  onSaved: (updated: PipelineLead) => void;
}) {
  const [form, setForm] = useState({
    status: lead.status ?? "new",
    assigned_to: lead.assigned_to ?? "",
    next_contact_at: lead.next_contact_at ?? "",
    deal_value: lead.deal_value?.toString() ?? "",
  });
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notes = lead.notes_log ?? [];

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: form.status,
          assigned_to: form.assigned_to.trim() || null,
          next_contact_at: form.next_contact_at || null,
          deal_value:
            form.deal_value === "" ? null : Number(form.deal_value),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      onSaved(data.lead as PipelineLead);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    if (!noteText.trim()) return;
    setError(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: noteText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar nota");
      onSaved(data.lead as PipelineLead);
      setNoteText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-10 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-2xl w-full p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">{lead.name ?? "(sem nome)"}</h3>
            <p className="text-sm text-slate-500">
              {lead.phone}
              {lead.instagram && ` · ${lead.instagram}`}
              {lead.archetype && ` · ${ARCH_LABEL[lead.archetype]}`}
              {lead.geo && ` · ${lead.geo}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Responsável">
            <input
              value={form.assigned_to}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
              placeholder="ex: Lucas, Bárbara"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </Field>
          <Field label="Próximo contato">
            <input
              type="date"
              value={form.next_contact_at}
              onChange={(e) =>
                setForm({ ...form, next_contact_at: e.target.value })
              }
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </Field>
          <Field label="Valor da venda (R$)">
            <input
              type="number"
              value={form.deal_value}
              onChange={(e) => setForm({ ...form, deal_value: e.target.value })}
              placeholder="ex: 25000"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </Field>
        </div>

        {/* Notas */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Adicionar nota
          </label>
          <div className="flex gap-2">
            <input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addNote();
                }
              }}
              placeholder="ex: Conversou e ficou de retornar até sexta"
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
            <button
              onClick={addNote}
              disabled={!noteText.trim()}
              className="px-3 py-2 text-sm rounded-md bg-slate-900 text-white disabled:opacity-40"
            >
              Adicionar
            </button>
          </div>
        </div>

        {notes.length > 0 && (
          <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
            {[...notes].reverse().map((n, i) => (
              <div
                key={i}
                className="bg-slate-50 border-l-2 border-emerald-500 px-3 py-2 rounded text-sm"
              >
                <p className="text-[11px] text-slate-400 mb-1">
                  {new Date(n.at).toLocaleString("pt-BR")} · {n.by}
                </p>
                <p>{n.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Quiz answers (collapsible) */}
        {lead.tags?.length > 0 && (
          <details className="mb-4 text-sm">
            <summary className="cursor-pointer font-semibold text-slate-600">
              Tags do quiz ({lead.tags.length})
            </summary>
            <div className="flex flex-wrap gap-1 mt-2">
              {lead.tags.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] rounded"
                >
                  {t}
                </span>
              ))}
            </div>
          </details>
        )}

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <div className="flex justify-between items-center">
          <a
            href={whatsLink(lead.phone, lead.name)}
            target="_blank"
            rel="noreferrer noopener"
            className="px-3 py-2 text-sm rounded-md bg-emerald-500 text-white hover:bg-emerald-600"
          >
            💬 WhatsApp
          </a>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 text-sm rounded-md border border-slate-200 hover:border-slate-400"
            >
              Fechar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-2 text-sm rounded-md bg-slate-900 text-white disabled:opacity-40"
            >
              {saving ? "Salvando..." : "💾 Salvar"}
            </button>
          </div>
        </div>
      </div>
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function fmtBRL(n: number): string {
  return (
    "R$ " +
    n.toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
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

function whatsLink(phone: string, name: string | null): string {
  const digits = phone.replace(/\D/g, "");
  const final = digits.startsWith("55") ? digits : `55${digits}`;
  const firstName = name?.split(" ")[0] ?? "";
  const msg = encodeURIComponent(
    `Oi${firstName ? " " + firstName : ""}! Aqui é da equipe da Dra. Juliana Pereira 🌸`,
  );
  return `https://wa.me/${final}?text=${msg}`;
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

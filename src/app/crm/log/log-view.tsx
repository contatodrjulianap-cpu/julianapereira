"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type LogDateRange = {
  preset: "all" | "today" | "yesterday" | "3d" | "7d" | "custom";
  start_at: string | null;
  end_at: string | null;
  label: string;
  from?: string;
  to?: string;
};

export type LogEvent = {
  id: string;
  type: string;
  direction: "inbound" | "outbound" | "internal";
  target: string | null;
  lead_id: string | null;
  status: "success" | "failed" | "skipped";
  payload: Record<string, unknown> | null;
  response: Record<string, unknown> | null;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
};

export type LeadLite = {
  id: string;
  name: string | null;
  phone: string;
};

const STATUS_BADGE: Record<LogEvent["status"], string> = {
  success: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  skipped: "bg-slate-200 text-slate-600",
};

const DIRECTION_BADGE: Record<LogEvent["direction"], string> = {
  inbound: "bg-blue-50 text-blue-700",
  outbound: "bg-purple-50 text-purple-700",
  internal: "bg-slate-100 text-slate-600",
};

const TYPE_COLOR: Record<string, string> = {
  quiz_pageview: "bg-rose-50 text-rose-700",
  quiz_step_view: "bg-amber-50 text-amber-700",
  quiz_wa_click: "bg-emerald-50 text-emerald-700",
  quiz_instagram_click: "bg-pink-50 text-pink-700",
  quiz_submit: "bg-green-100 text-green-800",
  fb_capi: "bg-blue-100 text-blue-800",
  zapi_send_text: "bg-emerald-100 text-emerald-800",
  zapi_webhook: "bg-indigo-100 text-indigo-800",
  lead_update: "bg-slate-100 text-slate-700",
  lead_note: "bg-yellow-50 text-yellow-700",
};

const STATUS_OPTS = ["all", "success", "failed", "skipped"] as const;
const DIRECTION_OPTS = ["all", "inbound", "outbound", "internal"] as const;
const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;
type UtmKey = (typeof UTM_KEYS)[number];

function getUtm(payload: Record<string, unknown> | null, key: UtmKey): string | null {
  if (!payload) return null;
  const v = payload[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function LogView({
  initialEvents,
  leads,
  range,
}: {
  initialEvents: LogEvent[];
  leads: LeadLite[];
  range: LogDateRange;
}) {
  const supabase = createClient();
  const [events, setEvents] = useState<LogEvent[]>(initialEvents);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] =
    useState<(typeof STATUS_OPTS)[number]>("all");
  const [filterDirection, setFilterDirection] =
    useState<(typeof DIRECTION_OPTS)[number]>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterUtm, setFilterUtm] = useState<Record<UtmKey, string>>({
    utm_source: "all",
    utm_medium: "all",
    utm_campaign: "all",
    utm_term: "all",
    utm_content: "all",
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Realtime: novos eventos. Filtra incoming por range pra não poluir a janela
  // (ex: filtro "Ontem" não deve receber eventos novos chegando agora).
  useEffect(() => {
    const ch = supabase
      .channel("event-log-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "event_log" },
        (payload) => {
          const ev = payload.new as LogEvent;
          if (range.start_at && ev.created_at < range.start_at) return;
          if (range.end_at && ev.created_at >= range.end_at) return;
          setEvents((prev) => [ev, ...prev].slice(0, 500));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, range.start_at, range.end_at]);

  const leadsById = useMemo(() => {
    const m = new Map<string, LeadLite>();
    for (const l of leads) m.set(l.id, l);
    return m;
  }, [leads]);

  // Tipos únicos pra dropdown
  const uniqueTypes = useMemo(() => {
    const s = new Set<string>();
    for (const e of events) s.add(e.type);
    return ["all", ...Array.from(s).sort()];
  }, [events]);

  // Valores únicos por UTM key (com 'none' = sem o UTM, 'all' = qualquer)
  const utmOptions = useMemo(() => {
    const map: Record<UtmKey, string[]> = {
      utm_source: [],
      utm_medium: [],
      utm_campaign: [],
      utm_term: [],
      utm_content: [],
    };
    for (const k of UTM_KEYS) {
      const set = new Set<string>();
      let hasNone = false;
      for (const e of events) {
        const v = getUtm(e.payload, k);
        if (v) set.add(v);
        else hasNone = true;
      }
      map[k] = [
        "all",
        ...(hasNone ? ["(sem)"] : []),
        ...Array.from(set).sort(),
      ];
    }
    return map;
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filterStatus !== "all" && e.status !== filterStatus) return false;
      if (filterDirection !== "all" && e.direction !== filterDirection)
        return false;
      if (filterType !== "all" && e.type !== filterType) return false;
      // UTM filters
      for (const k of UTM_KEYS) {
        const want = filterUtm[k];
        if (want === "all") continue;
        const val = getUtm(e.payload, k);
        if (want === "(sem)") {
          if (val !== null) return false;
        } else {
          if (val !== want) return false;
        }
      }
      if (search) {
        const t = search.toLowerCase();
        const lead = e.lead_id ? leadsById.get(e.lead_id) : null;
        const haystack = [
          e.type,
          e.target ?? "",
          e.error ?? "",
          lead?.name ?? "",
          lead?.phone ?? "",
          JSON.stringify(e.payload ?? {}),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(t)) return false;
      }
      return true;
    });
  }, [events, filterStatus, filterDirection, filterType, filterUtm, search, leadsById]);

  // Métricas
  const stats = useMemo(() => {
    const total = events.length;
    const ok = events.filter((e) => e.status === "success").length;
    const fail = events.filter((e) => e.status === "failed").length;
    const last5min = events.filter(
      (e) =>
        Date.now() - new Date(e.created_at).getTime() < 5 * 60 * 1000,
    ).length;
    return { total, ok, fail, last5min };
  }, [events]);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="max-w-[1280px] mx-auto px-5 lg:px-8 py-6 w-full">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Log de eventos</h2>
          <p className="text-sm text-slate-500">
            {filtered.length} de {events.length} · {range.label} · realtime
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            ao vivo
          </span>
        </div>
      </div>
      <DateFilter range={range} />
      <div className="mb-4" />

      {/* Métricas */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Total carregado" value={stats.total} />
        <Stat label="Sucesso" value={stats.ok} accent="emerald" />
        <Stat label="Falha" value={stats.fail} accent="red" />
        <Stat label="Últimos 5min" value={stats.last5min} accent="amber" />
      </section>

      {/* Filtros */}
      <section className="bg-white border border-slate-200 rounded-md p-3 mb-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Buscar tipo, lead, payload..."
          className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-slate-200 rounded-md outline-none focus:border-slate-900"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-md outline-none"
        >
          {uniqueTypes.map((t) => (
            <option key={t} value={t}>
              {t === "all" ? "Todos os tipos" : t}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          {STATUS_OPTS.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1.5 text-xs rounded-md border transition ${
                filterStatus === s
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
              }`}
            >
              {s === "all" ? "Status" : s}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {DIRECTION_OPTS.map((d) => (
            <button
              key={d}
              onClick={() => setFilterDirection(d)}
              className={`px-2.5 py-1.5 text-xs rounded-md border transition ${
                filterDirection === d
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
              }`}
            >
              {d === "all" ? "Direção" : d}
            </button>
          ))}
        </div>
      </section>

      {/* UTM filters */}
      <section className="bg-white border border-slate-200 rounded-md p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
            Filtros UTM
          </p>
          <button
            onClick={() =>
              setFilterUtm({
                utm_source: "all",
                utm_medium: "all",
                utm_campaign: "all",
                utm_term: "all",
                utm_content: "all",
              })
            }
            className="text-xs text-slate-500 hover:text-slate-900 underline"
          >
            limpar UTMs
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          {UTM_KEYS.map((k) => (
            <label key={k} className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                {k.replace("utm_", "")}
              </span>
              <select
                value={filterUtm[k]}
                onChange={(e) =>
                  setFilterUtm((prev) => ({ ...prev, [k]: e.target.value }))
                }
                className="px-2 py-1.5 text-xs border border-slate-200 rounded outline-none"
              >
                {utmOptions[k].map((v) => (
                  <option key={v} value={v}>
                    {v === "all" ? "Todos" : v}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      {/* Tabela */}
      <section className="bg-white border border-slate-200 rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <Th className="w-[120px]">Hora</Th>
                <Th>Tipo</Th>
                <Th className="hidden md:table-cell">Direção</Th>
                <Th className="hidden lg:table-cell">Target</Th>
                <Th>Status</Th>
                <Th className="hidden md:table-cell">Lead</Th>
                <Th className="hidden lg:table-cell text-right">ms</Th>
                <Th className="w-8"></Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-16 text-slate-400 text-sm"
                  >
                    Nenhum evento com esse filtro.
                  </td>
                </tr>
              )}
              {filtered.map((e) => {
                const isOpen = expanded.has(e.id);
                const lead = e.lead_id ? leadsById.get(e.lead_id) : null;
                return (
                  <FragmentRow
                    key={e.id}
                    event={e}
                    lead={lead ?? null}
                    isOpen={isOpen}
                    onToggle={() => toggleExpanded(e.id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-slate-400 mt-6 text-center">
        Mostrando até 300 eventos mais recentes · novos chegam em tempo real ·
        sem persistência de filtro entre sessões
      </p>
    </div>
  );
}

function FragmentRow({
  event,
  lead,
  isOpen,
  onToggle,
}: {
  event: LogEvent;
  lead: LeadLite | null;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const typeColor = TYPE_COLOR[event.type] ?? "bg-slate-100 text-slate-700";

  return (
    <>
      <tr
        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-3 py-2 text-slate-600 whitespace-nowrap font-mono text-[11px]">
          {fmtTime(event.created_at)}
          <span className="block text-[10px] text-slate-400">
            {fmtRel(event.created_at)}
          </span>
        </td>
        <td className="px-3 py-2">
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${typeColor}`}
          >
            {event.type}
          </span>
        </td>
        <td className="px-3 py-2 hidden md:table-cell">
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${DIRECTION_BADGE[event.direction]}`}
          >
            {event.direction}
          </span>
        </td>
        <td className="px-3 py-2 hidden lg:table-cell text-slate-600 text-[12px]">
          {event.target ?? "—"}
        </td>
        <td className="px-3 py-2">
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_BADGE[event.status]}`}
          >
            {event.status}
          </span>
        </td>
        <td className="px-3 py-2 hidden md:table-cell text-slate-600 text-[12px] truncate max-w-[160px]">
          {lead ? (
            <span title={lead.phone}>{lead.name ?? lead.phone}</span>
          ) : event.lead_id ? (
            <span className="text-slate-400 font-mono text-[10px]">
              {event.lead_id.slice(0, 8)}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="px-3 py-2 hidden lg:table-cell text-slate-600 text-right tabular-nums text-[12px]">
          {event.duration_ms ?? "—"}
        </td>
        <td className="px-3 py-2 text-slate-400">{isOpen ? "▼" : "▶"}</td>
      </tr>
      {isOpen && (
        <tr className="bg-slate-50 border-b border-slate-200">
          <td colSpan={8} className="px-4 py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
              {event.payload && (
                <Block title="Payload">
                  <pre className="text-[11px] overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(event.payload, null, 2)}
                  </pre>
                </Block>
              )}
              {event.response && (
                <Block title="Response">
                  <pre className="text-[11px] overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(event.response, null, 2)}
                  </pre>
                </Block>
              )}
              {event.error && (
                <Block title="Erro" className="md:col-span-2">
                  <pre className="text-[11px] text-red-700 whitespace-pre-wrap break-all">
                    {event.error}
                  </pre>
                </Block>
              )}
              {!event.payload && !event.response && !event.error && (
                <p className="text-slate-400 italic md:col-span-2">
                  Sem payload/response/error.
                </p>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-2 font-mono">
              id: {event.id}
            </p>
          </td>
        </tr>
      )}
    </>
  );
}

function Block({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-slate-200 rounded p-3 ${className ?? ""}`}>
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">
        {title}
      </p>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "emerald" | "red" | "amber";
}) {
  const color =
    accent === "emerald"
      ? "text-emerald-700"
      : accent === "red"
        ? "text-red-700"
        : accent === "amber"
          ? "text-amber-700"
          : "text-slate-900";
  return (
    <div className="bg-white border border-slate-200 rounded-md px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">
        {label}
      </p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
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

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmtRel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

const DATE_PRESETS: { key: LogDateRange["preset"]; label: string }[] = [
  { key: "all", label: "Tudo" },
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "3d", label: "Últimos 3 dias" },
  { key: "7d", label: "Últimos 7 dias" },
];

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function DateFilter({ range }: { range: LogDateRange }) {
  const router = useRouter();
  const [showCustom, setShowCustom] = useState(range.preset === "custom");
  const [from, setFrom] = useState(range.from ?? toIsoDate(new Date()));
  const [to, setTo] = useState(range.to ?? toIsoDate(new Date()));

  function apply() {
    if (!from || !to) return;
    if (from > to) {
      alert("Data 'de' não pode ser depois de 'até'");
      return;
    }
    router.push(`/crm/log?from=${from}&to=${to}`);
  }

  function reset() {
    const today = toIsoDate(new Date());
    setFrom(today);
    setTo(today);
    setShowCustom(false);
    router.push("/crm/log?preset=today");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="inline-flex items-center bg-white rounded-lg ring-1 ring-slate-200 p-0.5 shadow-sm w-fit">
        {DATE_PRESETS.map((p) => (
          <Link
            key={p.key}
            href={`/crm/log?preset=${p.key}`}
            onClick={() => setShowCustom(false)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
              range.preset === p.key
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </Link>
        ))}
        <button
          onClick={() => setShowCustom((v) => !v)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
            range.preset === "custom"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          Personalizado
        </button>
      </div>
      {showCustom && (
        <div className="flex items-center gap-2 bg-white ring-1 ring-slate-200 shadow-sm rounded-lg px-3 py-2 text-xs w-fit">
          <span className="text-slate-500">De</span>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="px-2 py-1 text-xs ring-1 ring-slate-200 rounded outline-none focus:ring-slate-400"
          />
          <span className="text-slate-500">Até</span>
          <input
            type="date"
            value={to}
            min={from}
            max={toIsoDate(new Date())}
            onChange={(e) => setTo(e.target.value)}
            className="px-2 py-1 text-xs ring-1 ring-slate-200 rounded outline-none focus:ring-slate-400"
          />
          <button
            onClick={apply}
            className="px-3 py-1 text-xs rounded-md bg-slate-900 text-white hover:bg-slate-700 font-medium"
          >
            Aplicar
          </button>
          <button
            onClick={reset}
            className="px-3 py-1 text-xs rounded-md ring-1 ring-slate-300 text-slate-700 hover:bg-slate-50 font-medium"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

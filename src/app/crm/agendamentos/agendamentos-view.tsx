"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ARCH_BADGE,
  ARCH_LABEL,
  LeadModal,
  STATUS_BADGE,
  STATUS_LABEL,
  whatsLink,
  type LeadFull,
} from "../lead-modal";

export type AgLead = LeadFull;
export type CrmUser = { id: string; display_name: string; role: string };

type ViewMode = "kanban" | "calendar";
const VIEW_KEY = "sakura.agenda.view";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Data no calendário de São Paulo (YYYY-MM-DD). toISOString() seria UTC e
// viraria o dia depois das 21h BRT.
function spYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// Hora local (HH:mm) do agendamento.
function spTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const pad = (n: number) => n.toString().padStart(2, "0");

// Status que contam como "compareceu / fechou" — não precisam mais de atenção.
const DONE = new Set(["attended", "won"]);

export function AgendamentosView({
  initialLeads,
  users = [],
  isAdmin = false,
}: {
  initialLeads: AgLead[];
  users?: CrmUser[];
  isAdmin?: boolean;
}) {
  const supabase = createClient();
  const [leads, setLeads] = useState<AgLead[]>(initialLeads);
  const [editing, setEditing] = useState<AgLead | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");

  const usersById = useMemo(() => {
    const map: Record<string, CrmUser> = {};
    for (const u of users) map[u.id] = u;
    return map;
  }, [users]);

  // Hydrata/persiste viewMode
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(VIEW_KEY);
    if (stored === "kanban" || stored === "calendar") setViewMode(stored);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIEW_KEY, viewMode);
  }, [viewMode]);

  // Realtime — mantém leads com scheduled_at sincronizados
  useEffect(() => {
    const ch = supabase
      .channel("leads-agenda")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setLeads((prev) => prev.filter((l) => l.id !== (payload.old as AgLead).id));
            return;
          }
          const row = payload.new as AgLead;
          setLeads((prev) => {
            const without = prev.filter((l) => l.id !== row.id);
            // Só entra/permanece se tiver call agendada.
            return row.scheduled_at ? [...without, row] : without;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase]);

  // Só os que têm scheduled_at (realtime pode trazer sem)
  const scheduled = useMemo(
    () => leads.filter((l) => !!l.scheduled_at),
    [leads],
  );

  const onSaved = useCallback((updated: AgLead) => {
    setLeads((prev) => {
      const without = prev.filter((l) => l.id !== updated.id);
      return updated.scheduled_at ? [...without, updated] : without;
    });
    setEditing(updated.scheduled_at ? updated : null);
  }, []);

  // Métricas topo
  const stats = useMemo(() => {
    const today = spYmd(new Date());
    const month = today.slice(0, 7);
    let hoje = 0;
    let compareceramMes = 0;
    let agendadosMes = 0;
    for (const l of scheduled) {
      const ymd = spYmd(new Date(l.scheduled_at!));
      if (ymd === today) hoje++;
      if (ymd.slice(0, 7) === month) {
        agendadosMes++;
        if (DONE.has(l.status ?? "")) compareceramMes++;
      }
    }
    return { total: scheduled.length, hoje, agendadosMes, compareceramMes };
  }, [scheduled]);

  return (
    <div className="max-w-[1280px] mx-auto px-5 lg:px-8 py-6 w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight">📆 Agenda</h2>
          <p className="text-sm text-slate-500">
            {scheduled.length} calls agendadas
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Modo de visualização da agenda"
          className="inline-flex bg-white border border-slate-200 rounded-md p-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "kanban"}
            onClick={() => setViewMode("kanban")}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
              viewMode === "kanban"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            🗂️ Dia a dia
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "calendar"}
            onClick={() => setViewMode("calendar")}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
              viewMode === "calendar"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            📅 Calendário
          </button>
        </div>
      </div>

      {/* Métricas */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Agendadas no total" value={stats.total} />
        <Stat label="Calls hoje" value={stats.hoje} accent="cyan" />
        <Stat label="Agendadas no mês" value={stats.agendadosMes} accent="sky" />
        <Stat
          label="Compareceram no mês"
          value={stats.compareceramMes}
          accent="teal"
        />
      </section>

      {viewMode === "kanban" ? (
        <DiaADiaKanban
          leads={scheduled}
          usersById={usersById}
          isAdmin={isAdmin}
          onCardClick={setEditing}
        />
      ) : (
        <CalendarView
          leads={scheduled}
          usersById={usersById}
          isAdmin={isAdmin}
          onCardClick={setEditing}
        />
      )}

      {editing && (
        <LeadModal
          lead={editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

// ============================================================
// Kanban Dia a Dia — colunas Passados / Hoje / Amanhã / Próximos
// ============================================================

type Bucket = "passados" | "hoje" | "amanha" | "proximos";
const BUCKET_META: Record<Bucket, { title: string; emoji: string; tint: string }> = {
  passados: { title: "Passados", emoji: "⏪", tint: "bg-slate-100" },
  hoje: { title: "Hoje", emoji: "🔥", tint: "bg-rose-50" },
  amanha: { title: "Amanhã", emoji: "🌅", tint: "bg-amber-50" },
  proximos: { title: "Próximos dias", emoji: "📅", tint: "bg-sky-50" },
};
const BUCKET_ORDER: Bucket[] = ["passados", "hoje", "amanha", "proximos"];

function DiaADiaKanban({
  leads,
  usersById,
  isAdmin,
  onCardClick,
}: {
  leads: AgLead[];
  usersById: Record<string, CrmUser>;
  isAdmin: boolean;
  onCardClick: (l: AgLead) => void;
}) {
  const { todayYmd, tomorrowYmd } = useMemo(() => {
    const now = new Date();
    return {
      todayYmd: spYmd(now),
      tomorrowYmd: spYmd(new Date(now.getTime() + 86_400_000)),
    };
  }, []);

  const byBucket = useMemo(() => {
    const map: Record<Bucket, AgLead[]> = {
      passados: [], hoje: [], amanha: [], proximos: [],
    };
    for (const l of leads) {
      const ymd = spYmd(new Date(l.scheduled_at!));
      let b: Bucket;
      if (ymd < todayYmd) b = "passados";
      else if (ymd === todayYmd) b = "hoje";
      else if (ymd === tomorrowYmd) b = "amanha";
      else b = "proximos";
      map[b].push(l);
    }
    for (const b of BUCKET_ORDER) {
      map[b].sort(
        (a, c) =>
          new Date(a.scheduled_at!).getTime() - new Date(c.scheduled_at!).getTime(),
      );
    }
    return map;
  }, [leads, todayYmd, tomorrowYmd]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {BUCKET_ORDER.map((b) => {
        const meta = BUCKET_META[b];
        const cards = byBucket[b];
        return (
          <div key={b} className={`${meta.tint} rounded-lg flex flex-col`}>
            <div className="px-3 py-2.5 flex items-center justify-between border-b border-black/5">
              <span className="text-[13px] font-bold text-slate-800">
                {meta.emoji} {meta.title}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                {cards.length}
              </span>
            </div>
            <div className="p-2 space-y-2 min-h-[80px]">
              {cards.length === 0 ? (
                <div className="text-center py-6 text-[11px] text-slate-400">
                  sem calls
                </div>
              ) : (
                cards.map((l) => (
                  <AgendaCard
                    key={l.id}
                    lead={l}
                    usersById={usersById}
                    isAdmin={isAdmin}
                    showDay={b === "proximos" || b === "passados"}
                    onClick={() => onCardClick(l)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Calendário mês — grid estilo Google + lista do dia selecionado
// ============================================================

function CalendarView({
  leads,
  usersById,
  isAdmin,
  onCardClick,
}: {
  leads: AgLead[];
  usersById: Record<string, CrmUser>;
  isAdmin: boolean;
  onCardClick: (l: AgLead) => void;
}) {
  const todayYmd = useMemo(() => spYmd(new Date()), []);
  const [mode, setMode] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(() => {
    const [y, m] = todayYmd.split("-").map(Number);
    return { y, m: m - 1 }; // m 0-indexed
  });
  const [selected, setSelected] = useState<string>(todayYmd);

  // No celular o Mês fica apertado (7 colunas) — abre em Semana por padrão.
  // Roda só no mount (client); desktop continua em Mês. Toggle manual vence.
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 639px)").matches
    ) {
      setMode("week");
    }
  }, []);

  // Mapa ymd → leads
  const byDay = useMemo(() => {
    const map = new Map<string, AgLead[]>();
    for (const l of leads) {
      const ymd = spYmd(new Date(l.scheduled_at!));
      const arr = map.get(ymd) ?? [];
      arr.push(l);
      map.set(ymd, arr);
    }
    for (const arr of map.values()) {
      arr.sort(
        (a, c) =>
          new Date(a.scheduled_at!).getTime() - new Date(c.scheduled_at!).getTime(),
      );
    }
    return map;
  }, [leads]);

  // Grid do mês (Domingo-start)
  const cells = useMemo(() => {
    const firstWeekday = new Date(cursor.y, cursor.m, 1).getDay(); // 0=Dom
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const out: Array<{ ymd: string; day: number } | null> = [];
    for (let i = 0; i < firstWeekday; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ ymd: `${cursor.y}-${pad(cursor.m + 1)}-${pad(d)}`, day: d });
    }
    return out;
  }, [cursor]);

  // 7 dias da semana que contém `selected` (Domingo-start)
  const weekDays = useMemo(() => weekYmds(selected), [selected]);

  const selectedLeads = byDay.get(selected) ?? [];

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const nm = c.m + delta;
      const y = c.y + Math.floor(nm / 12);
      const m = ((nm % 12) + 12) % 12;
      return { y, m };
    });
  }

  // Navega ±7 dias (modo semana). Mantém o mês do grid em sincronia.
  function shiftWeek(delta: number) {
    setSelected((cur) => {
      const next = shiftYmd(cur, delta * 7);
      const [y, m] = next.split("-").map(Number);
      setCursor({ y, m: m - 1 });
      return next;
    });
  }

  const headerLabel =
    mode === "month"
      ? `${MONTHS[cursor.m]} ${cursor.y}`
      : fmtWeekLabel(weekDays);

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-4">
      {/* Calendário */}
      <div className="bg-white border border-slate-200 rounded-lg p-3">
        {/* Nav + label + toggle Mês/Semana */}
        <div className="flex items-center justify-between gap-2 mb-3 px-1">
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => (mode === "month" ? shiftMonth(-1) : shiftWeek(-1))}
              className="px-2 py-1 rounded-md hover:bg-slate-100 text-slate-600"
              aria-label="Anterior"
            >
              ‹
            </button>
            <button
              onClick={() => {
                setSelected(todayYmd);
                const [y, m] = todayYmd.split("-").map(Number);
                setCursor({ y, m: m - 1 });
              }}
              className="px-2 py-1 rounded-md hover:bg-slate-100 text-[11px] font-semibold text-slate-600"
            >
              Hoje
            </button>
            <button
              onClick={() => (mode === "month" ? shiftMonth(1) : shiftWeek(1))}
              className="px-2 py-1 rounded-md hover:bg-slate-100 text-slate-600"
              aria-label="Próximo"
            >
              ›
            </button>
          </div>
          <h3 className="text-sm font-bold text-slate-800 capitalize truncate">
            {headerLabel}
          </h3>
          <div
            role="tablist"
            aria-label="Mês ou semana"
            className="inline-flex bg-slate-100 rounded-md p-0.5 shrink-0"
          >
            {(["month", "week"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded transition ${
                  mode === m
                    ? "bg-white shadow-sm text-slate-900"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {m === "month" ? "Mês" : "Semana"}
              </button>
            ))}
          </div>
        </div>

        {/* ===== Mês ===== */}
        {mode === "month" && (
          <>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map((w) => (
                <div
                  key={w}
                  className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 py-1"
                >
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell, i) => {
                if (!cell) return <div key={`b-${i}`} />;
                const dayLeads = byDay.get(cell.ymd) ?? [];
                const isToday = cell.ymd === todayYmd;
                const isSelected = cell.ymd === selected;
                return (
                  <div
                    key={cell.ymd}
                    onClick={() => setSelected(cell.ymd)}
                    className={`min-h-[64px] sm:min-h-[78px] rounded-md p-1 flex flex-col gap-0.5 cursor-pointer transition border ${
                      isSelected
                        ? "border-slate-900 bg-slate-50"
                        : isToday
                          ? "border-cyan-300 bg-cyan-50"
                          : "border-transparent hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`text-[11px] leading-none px-0.5 ${
                        isToday ? "font-bold text-cyan-800" : "text-slate-500"
                      }`}
                    >
                      {cell.day}
                    </span>
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      {dayLeads.slice(0, 3).map((l) => (
                        <DayEventChip key={l.id} lead={l} onClick={onCardClick} />
                      ))}
                      {dayLeads.length > 3 && (
                        <span className="text-[9px] text-slate-400 px-1">
                          +{dayLeads.length - 3} mais
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ===== Semana ===== */}
        {mode === "week" && (
          <div className="grid grid-cols-1 sm:grid-cols-7 gap-1">
            {weekDays.map((ymd, i) => {
              const dayLeads = byDay.get(ymd) ?? [];
              const isToday = ymd === todayYmd;
              const dd = ymd.slice(8, 10);
              return (
                <div
                  key={ymd}
                  className={`rounded-md border p-1.5 sm:min-h-[140px] flex flex-col ${
                    isToday ? "border-cyan-300 bg-cyan-50" : "border-slate-200"
                  }`}
                >
                  <button
                    onClick={() => setSelected(ymd)}
                    className={`text-left text-[11px] font-semibold mb-1 ${
                      isToday ? "text-cyan-800" : "text-slate-600"
                    }`}
                  >
                    {WEEKDAYS[i]} {dd}
                    {dayLeads.length > 0 && (
                      <span className="ml-1 text-slate-400">· {dayLeads.length}</span>
                    )}
                  </button>
                  <div className="flex flex-col gap-1">
                    {dayLeads.length === 0 ? (
                      <span className="text-[10px] text-slate-300 px-0.5">—</span>
                    ) : (
                      dayLeads.map((l) => (
                        <DayEventChip key={l.id} lead={l} onClick={onCardClick} big />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lista do dia selecionado */}
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-2">
          {fmtSelectedLabel(selected, todayYmd)}
          <span className="text-xs font-normal text-slate-400 ml-2">
            ({selectedLeads.length})
          </span>
        </h3>
        {selectedLeads.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center bg-white border border-slate-200 rounded-lg">
            Nenhuma call agendada nesse dia.
          </p>
        ) : (
          <div className="space-y-2">
            {selectedLeads.map((l) => (
              <AgendaCard
                key={l.id}
                lead={l}
                usersById={usersById}
                isAdmin={isAdmin}
                onClick={() => onCardClick(l)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Card compartilhado
// ============================================================

function AgendaCard({
  lead,
  usersById,
  isAdmin,
  showDay = false,
  onClick,
}: {
  lead: AgLead;
  usersById: Record<string, CrmUser>;
  isAdmin: boolean;
  showDay?: boolean;
  onClick: () => void;
}) {
  const ownerLabel = lead.assigned_owner_id
    ? usersById[lead.assigned_owner_id]?.display_name
    : null;
  const when = lead.scheduled_at!;
  const dayLabel = showDay
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
      }).format(new Date(when))
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="bg-white rounded-md border border-slate-200 p-3 cursor-pointer active:bg-slate-50 hover:border-slate-400 transition"
    >
      <div className="flex items-start gap-2">
        {lead.selfie_signed_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lead.selfie_signed_url}
            alt=""
            className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-[13px] leading-tight truncate">
            {lead.name ?? <span className="text-slate-400 italic">sem nome</span>}
          </p>
          <p className="text-[11px] text-slate-500 truncate">{lead.phone}</p>
        </div>
        <span className="shrink-0 text-right">
          <span className="block text-[13px] font-bold text-slate-900 tabular-nums">
            {spTime(when)}
          </span>
          {dayLabel && (
            <span className="block text-[10px] text-slate-400">{dayLabel}</span>
          )}
        </span>
      </div>

      <div className="flex items-center flex-wrap gap-1 mt-2">
        {lead.status && (
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE[lead.status] ?? "bg-slate-100 text-slate-700"}`}
          >
            {STATUS_LABEL[lead.status] ?? lead.status}
          </span>
        )}
        {lead.archetype && (
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${ARCH_BADGE[lead.archetype]}`}
          >
            {ARCH_LABEL[lead.archetype]}
          </span>
        )}
        {lead.call_recording_url && (
          <a
            href={lead.call_recording_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700 hover:bg-rose-200"
            title="Abrir gravação (TLDV)"
          >
            🎥 gravação
          </a>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100">
        {isAdmin && ownerLabel ? (
          <span className="text-[10px] text-slate-500 truncate">👤 {ownerLabel}</span>
        ) : (
          <span />
        )}
        <a
          href={whatsLink(lead.phone, lead.name)}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(e) => e.stopPropagation()}
          aria-label={`WhatsApp de ${lead.name ?? lead.phone}`}
          className="flex-shrink-0 inline-flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded-full text-[10px] font-semibold transition"
        >
          <svg viewBox="0 0 32 32" fill="currentColor" className="w-3 h-3" aria-hidden="true">
            <path d="M16.003 3C9.376 3 4 8.376 4 15c0 2.353.689 4.546 1.873 6.405L4 28l6.764-1.834A12 12 0 0 0 16.003 27C22.63 27 28 21.624 28 15S22.63 3 16.003 3z" />
          </svg>
          WPP
        </a>
      </div>
    </div>
  );
}

// Linha clicável de evento dentro de uma célula do calendário (hora + nome).
function DayEventChip({
  lead,
  onClick,
  big = false,
}: {
  lead: AgLead;
  onClick: (l: AgLead) => void;
  big?: boolean;
}) {
  const name = lead.name ?? lead.phone;
  const time = spTime(lead.scheduled_at!);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(lead);
      }}
      title={`${time} · ${name}`}
      className={`w-full text-left truncate rounded bg-cyan-100 text-cyan-900 hover:bg-cyan-200 transition leading-tight ${
        big ? "px-1.5 py-1 text-[11px]" : "px-1 py-0.5 text-[10px]"
      }`}
    >
      <span className="font-semibold tabular-nums">{time}</span> {name}
    </button>
  );
}

// 7 ymds (Domingo→Sábado) da semana que contém `ymd`.
function weekYmds(ymd: string): string[] {
  const [y, m, d] = ymd.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  const sunday = new Date(y, m - 1, d - base.getDay());
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i);
    out.push(`${dd.getFullYear()}-${pad(dd.getMonth() + 1)}-${pad(dd.getDate())}`);
  }
  return out;
}

// Desloca um ymd por N dias (pode ser negativo).
function shiftYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const nd = new Date(y, m - 1, d + deltaDays);
  return `${nd.getFullYear()}-${pad(nd.getMonth() + 1)}-${pad(nd.getDate())}`;
}

// "01/06 – 07/06" pro header do modo semana.
function fmtWeekLabel(week: string[]): string {
  const first = week[0];
  const last = week[6];
  return `${first.slice(8, 10)}/${first.slice(5, 7)} – ${last.slice(8, 10)}/${last.slice(5, 7)}`;
}

function fmtSelectedLabel(ymd: string, todayYmd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekdayFull = [
    "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado",
  ][date.getDay()];
  const base = `${weekdayFull}, ${pad(d)}/${pad(m)}`;
  if (ymd === todayYmd) return `📍 Hoje · ${base}`;
  return base;
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "cyan" | "sky" | "teal";
}) {
  const fg =
    accent === "cyan"
      ? "text-cyan-700"
      : accent === "sky"
        ? "text-sky-700"
        : accent === "teal"
          ? "text-teal-700"
          : "text-slate-900";
  return (
    <div className="bg-white border border-slate-200 rounded-md px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">
        {label}
      </p>
      <p className={`font-bold text-2xl ${fg}`}>{value}</p>
    </div>
  );
}

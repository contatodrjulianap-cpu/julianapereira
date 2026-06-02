"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { STATUS_OPTIONS, STATUS_LABEL } from "@/lib/lead-status";

// Filtros da tela "Todos os leads". Cada mudança dá push na URL (server refaz a
// query paginada). Sempre zera o page pra voltar pra página 1 ao filtrar.

const ARCHETYPE_OPTS: Array<{ value: string; label: string }> = [
  { value: "PRONTA", label: "🔥 Pronto" },
  { value: "ESPERANCOSA", label: "🟡 Esperançoso" },
  { value: "CETICA", label: "🤔 Cético" },
  { value: "sem", label: "Sem classificação" },
];

const SOURCE_OPTS: Array<{ value: string; label: string }> = [
  { value: "instagram", label: "Instagram" },
  { value: "google", label: "Google" },
  { value: "tiktok", label: "TikTok" },
  { value: "quiz", label: "Quiz" },
  { value: "indicacao", label: "Indicação" },
  { value: "organico", label: "Orgânico" },
  { value: "whatsapp", label: "WhatsApp" },
];

export function LeadsFilters({
  q,
  status,
  archetype,
  source,
  owner,
  attendants,
  isAdmin,
}: {
  q: string;
  status: string;
  archetype: string;
  source: string;
  owner: string;
  attendants: Array<{ id: string; display_name: string | null }>;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(q);

  function buildUrl(params: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.delete("page"); // qualquer filtro volta pra página 1
    for (const [k, v] of Object.entries(params)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function setParam(key: string, value: string) {
    router.push(buildUrl({ [key]: value || null }));
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildUrl({ q: search.trim() || null }));
  }

  const selectClass =
    "px-2.5 py-1.5 text-[12px] bg-white border border-slate-200 rounded-lg outline-none focus:border-rose-300 text-slate-700";

  return (
    <div className="space-y-2.5">
      <form onSubmit={submitSearch} className="flex gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou telefone…"
          className="flex-1 px-3 py-2 text-[13px] bg-white border border-slate-200 rounded-lg outline-none focus:border-rose-300"
        />
        <button
          type="submit"
          className="px-4 py-2 text-[13px] font-semibold bg-slate-900 text-white rounded-lg active:opacity-80"
        >
          Buscar
        </button>
      </form>

      <div className="flex gap-2 flex-wrap">
        <select
          value={status}
          onChange={(e) => setParam("status", e.target.value)}
          className={selectClass}
          aria-label="Status"
        >
          <option value="">Todos os status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s] ?? s}
            </option>
          ))}
        </select>

        <select
          value={archetype}
          onChange={(e) => setParam("archetype", e.target.value)}
          className={selectClass}
          aria-label="Arquétipo"
        >
          <option value="">Todos os arquétipos</option>
          {ARCHETYPE_OPTS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>

        <select
          value={source}
          onChange={(e) => setParam("source", e.target.value)}
          className={selectClass}
          aria-label="Origem"
        >
          <option value="">Todas as origens</option>
          {SOURCE_OPTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {isAdmin && (
          <select
            value={owner}
            onChange={(e) => setParam("owner", e.target.value)}
            className={selectClass}
            aria-label="Responsável"
          >
            <option value="">Todos os responsáveis</option>
            <option value="_unassigned">Sem responsável</option>
            {attendants.map((a) => (
              <option key={a.id} value={a.id}>
                {a.display_name ?? a.id.slice(0, 8)}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

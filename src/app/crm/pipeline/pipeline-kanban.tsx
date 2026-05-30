"use client";

import { useState } from "react";
import {
  ARCH_BADGE,
  ARCH_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
  STATUS_OPTIONS,
  fmtBRL,
  whatsLink,
} from "../lead-modal";
import type { PipelineLead, CrmUser } from "./pipeline-view";

type Props = {
  filtered: PipelineLead[];
  usersById: Record<string, CrmUser>;
  onCardClick: (lead: PipelineLead) => void;
  onStatusChange: (leadId: string, newStatus: string) => void;
};

// Profissão vem da pergunta q4 do quiz (texto livre). Não é selecionável.
function getProfissao(lead: PipelineLead): string | null {
  const qa = lead.quiz_answers as Record<string, unknown> | null;
  if (!qa) return null;
  const p = qa.q4_profissao;
  if (typeof p !== "string") return null;
  const trimmed = p.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function fmtSince(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mês`;
}

export function PipelineKanban({
  filtered,
  usersById,
  onCardClick,
  onStatusChange,
}: Props) {
  // Agrupa por status
  const byStatus: Record<string, PipelineLead[]> = {};
  for (const s of STATUS_OPTIONS) byStatus[s] = [];
  for (const l of filtered) {
    const s = l.status ?? "new";
    if (byStatus[s]) byStatus[s].push(l);
    else byStatus.new.push(l);
  }

  // Coluna ativa no mobile (1 visível por vez)
  const [mobileCol, setMobileCol] = useState<string>("new");

  // Drag state (desktop)
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  function handleDragStart(e: React.DragEvent, lead: PipelineLead) {
    setDraggingId(lead.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", lead.id);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverCol(null);
  }

  function handleDragOver(e: React.DragEvent, status: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== status) setDragOverCol(status);
  }

  function handleDrop(e: React.DragEvent, status: string) {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("text/plain") || draggingId;
    setDraggingId(null);
    setDragOverCol(null);
    if (!leadId) return;
    const lead = filtered.find((l) => l.id === leadId);
    if (!lead) return;
    const curStatus = lead.status ?? "new";
    if (curStatus === status) return;
    onStatusChange(leadId, status);
  }

  return (
    <>
      {/* =================== MOBILE =================== */}
      <div className="md:hidden">
        {/* Tabs de status (1 coluna por vez) */}
        <div className="-mx-5 px-5 mb-3 overflow-x-auto">
          <div className="flex gap-2 whitespace-nowrap">
            {STATUS_OPTIONS.map((s) => {
              const isActive = mobileCol === s;
              const count = byStatus[s].length;
              return (
                <button
                  key={s}
                  onClick={() => setMobileCol(s)}
                  className={`flex-shrink-0 px-3 py-2 rounded-full text-xs font-semibold ring-1 transition ${
                    isActive
                      ? `${STATUS_BADGE[s]} ring-current`
                      : "bg-white text-slate-700 ring-slate-300"
                  }`}
                >
                  {STATUS_LABEL[s]}{" "}
                  <span className="opacity-70 ml-0.5">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cards da coluna ativa */}
        <div className="space-y-2">
          {byStatus[mobileCol].length === 0 ? (
            <div className="bg-white rounded-md border border-slate-200 p-8 text-center text-sm text-slate-500">
              Sem leads em <strong>{STATUS_LABEL[mobileCol]}</strong>.
            </div>
          ) : (
            byStatus[mobileCol].map((l) => (
              <KanbanCard
                key={l.id}
                lead={l}
                usersById={usersById}
                onClick={() => onCardClick(l)}
              />
            ))
          )}
        </div>
      </div>

      {/* =================== DESKTOP =================== */}
      <div className="hidden md:block -mx-5 lg:-mx-8 px-5 lg:px-8">
        <div className="flex gap-3 overflow-x-auto pb-3 min-h-[60vh]">
          {STATUS_OPTIONS.map((s) => {
            const cards = byStatus[s];
            const isDropTarget = dragOverCol === s;
            return (
              <div
                key={s}
                onDragOver={(e) => handleDragOver(e, s)}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={(e) => handleDrop(e, s)}
                className={`flex-shrink-0 w-72 bg-slate-100 rounded-md flex flex-col max-h-[calc(100vh-260px)] ${
                  isDropTarget ? "ring-2 ring-slate-900 ring-offset-2" : ""
                }`}
              >
                {/* Header da coluna */}
                <div className="sticky top-0 z-10 bg-slate-100 px-3 py-2.5 rounded-t-md flex items-center justify-between border-b border-slate-200">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${STATUS_BADGE[s]}`}
                  >
                    {STATUS_LABEL[s]}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {cards.length}
                  </span>
                </div>

                {/* Lista de cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {cards.length === 0 ? (
                    <div className="text-center py-6 text-[11px] text-slate-400">
                      vazio
                    </div>
                  ) : (
                    cards.map((l) => (
                      <div
                        key={l.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, l)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onCardClick(l)}
                        className={`bg-white rounded-md border border-slate-200 p-3 cursor-grab active:cursor-grabbing hover:border-slate-400 transition ${
                          draggingId === l.id ? "opacity-40" : ""
                        }`}
                      >
                        <KanbanCardInner lead={l} usersById={usersById} compact />
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-400 mt-2 px-1">
          💡 Arraste cards entre colunas pra mudar status. Clique pra abrir.
        </p>
      </div>
    </>
  );
}

function KanbanCard({
  lead,
  usersById,
  onClick,
}: {
  lead: PipelineLead;
  usersById: Record<string, CrmUser>;
  onClick: () => void;
}) {
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
      className="bg-white rounded-md border border-slate-200 p-3 active:bg-slate-50 transition cursor-pointer"
    >
      <KanbanCardInner lead={lead} usersById={usersById} />
    </div>
  );
}

function KanbanCardInner({
  lead,
  usersById,
  compact = false,
}: {
  lead: PipelineLead;
  usersById: Record<string, CrmUser>;
  compact?: boolean;
}) {
  const profissao = getProfissao(lead);
  const ownerLabel = lead.assigned_owner_id
    ? usersById[lead.assigned_owner_id]?.display_name
    : null;

  return (
    <>
      <div className="flex items-start gap-2 mb-1.5">
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
          <p className={`font-semibold text-slate-900 leading-tight truncate ${compact ? "text-[13px]" : "text-sm"}`}>
            {lead.name ?? <span className="text-slate-400 italic">sem nome</span>}
          </p>
          {profissao && (
            <p className="text-[11px] text-slate-600 truncate mt-0.5">
              💼 {profissao}
            </p>
          )}
        </div>
        <span className="text-[10px] text-slate-400 flex-shrink-0">
          {fmtSince(lead.created_at)}
        </span>
      </div>

      <div className="flex items-center flex-wrap gap-1 mt-2">
        {lead.archetype && (
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${ARCH_BADGE[lead.archetype]}`}
          >
            {ARCH_LABEL[lead.archetype]}
          </span>
        )}
        {lead.geo && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
            📍 {lead.geo}
          </span>
        )}
        {lead.deal_value && Number(lead.deal_value) > 0 ? (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
            {fmtBRL(Number(lead.deal_value))}
          </span>
        ) : null}
      </div>

      {(ownerLabel || lead.phone) && (
        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100">
          {ownerLabel ? (
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
      )}
    </>
  );
}

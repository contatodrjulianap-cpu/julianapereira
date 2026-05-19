"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LeadFull } from "../lead-modal";
import type { LastMessage } from "./page";
import { ConversationCard } from "./conversation-card";
import {
  PipelineBar,
  bucketOf,
  countByBucket,
  type Bucket,
} from "./pipeline-bar";
import { LeadActionsSheet, type LeadActionPayload } from "./lead-actions-sheet";

type LeadCard = LeadFull & {
  selfie_signed_url?: string | null;
  last_message: LastMessage | null;
};

export function ConversationList({ initialLeads }: { initialLeads: LeadCard[] }) {
  const router = useRouter();
  const [leads, setLeads] = useState<LeadCard[]>(initialLeads);
  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<Bucket>("todos");
  const [sheetLead, setSheetLead] = useState<LeadCard | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads
      .filter((l) => {
        if (bucket !== "todos" && bucketOf(l.status) !== bucket) return false;
        if (!q) return true;
        const text = `${l.name ?? ""} ${l.phone} ${l.last_message?.text ?? ""}`.toLowerCase();
        return text.includes(q);
      })
      .sort((a, b) => {
        // Fixados primeiro, depois por last_message_at desc
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return bt - at;
      });
  }, [leads, search, bucket]);

  const counts = useMemo(() => countByBucket(leads), [leads]);

  function applyPatched(updated: LeadFull) {
    setLeads((prev) =>
      prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)),
    );
  }

  async function handleSheetAction(a: LeadActionPayload) {
    if (!sheetLead) return;
    if (a.kind === "open_details") {
      setSheetLead(null);
      router.push(`/crm/conversas/${sheetLead.id}`);
      return;
    }
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
    <div className="flex-1 flex flex-col bg-white min-h-0 min-w-0 overflow-x-hidden w-full">
      <header className="md:hidden sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3">
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">
          Conversas
        </h1>
      </header>

      <PipelineBar active={bucket} onChange={setBucket} counts={counts} />

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
    </div>
  );
}

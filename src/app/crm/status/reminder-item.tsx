"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Props = {
  id: string;
  title: string;
  leadId: string;
  ownerName?: string | null;
};

// Item da fila de lembrete de avaliação. O atendente abre a conversa, manda a
// mensagem NA MÃO e marca como feita. Sem disparo automático.
export function ReminderItem({ id, title, leadId, ownerName }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function markDone() {
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: true }),
      });
      if (res.ok) router.refresh();
      else setBusy(false);
    } catch {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-lg bg-white border border-amber-200 px-3 py-2 flex items-center gap-2">
      <Link href={`/crm/conversas/${leadId}`} className="flex-1 min-w-0 active:opacity-70">
        <p className="text-[13px] font-semibold text-slate-900 leading-snug">
          {title}
        </p>
        {ownerName && (
          <p className="text-[11px] text-slate-500 mt-0.5">👤 {ownerName}</p>
        )}
      </Link>
      <button
        type="button"
        onClick={markDone}
        disabled={busy}
        className="shrink-0 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5 active:bg-emerald-100 disabled:opacity-50"
      >
        {busy ? "…" : "✓ feito"}
      </button>
    </li>
  );
}

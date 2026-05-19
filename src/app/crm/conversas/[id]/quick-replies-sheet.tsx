"use client";

import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "../bottom-sheet";
import { interpolate, type TemplateContext } from "@/lib/template-vars";

export type QuickReply = {
  id: string;
  name: string;
  emoji: string;
  body: string;
  category: string | null;
  favorite: boolean;
  uses_count: number;
};

export function QuickRepliesSheet({
  open,
  onClose,
  ctx,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  ctx: TemplateContext;
  onPick: (text: string, replyId: string) => void;
}) {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    fetch("/api/quick-replies")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setReplies((d.replies as QuickReply[]) ?? []);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return replies;
    return replies.filter(
      (r) =>
        r.name.toLowerCase().includes(q) || r.body.toLowerCase().includes(q),
    );
  }, [replies, search]);

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="80vh">
      <header className="px-5 pb-3 flex items-center justify-between shrink-0">
        <h3 className="text-base font-semibold text-slate-900">
          ⚡ Respostas rápidas
        </h3>
        <a
          href="/crm/voce/respostas-rapidas"
          className="text-xs text-slate-500"
        >
          Gerenciar
        </a>
      </header>
      <div className="px-3 pb-2 shrink-0">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar template..."
          autoFocus
          className="w-full px-3 py-2 text-sm bg-slate-100 rounded-lg outline-none"
        />
      </div>

      <ul className="px-2 pb-3">
        {loading ? (
          <li className="p-4 text-center text-sm text-slate-400">
            Carregando...
          </li>
        ) : filtered.length === 0 ? (
          <li className="p-4 text-center text-sm text-slate-400">
            {replies.length === 0
              ? "Nenhum template ainda. Pressiona uma msg enviada pra salvar a primeira."
              : "Nada encontrado."}
          </li>
        ) : (
          filtered.map((r) => {
            const preview = interpolate(r.body, ctx);
            return (
              <li key={r.id}>
                <button
                  onClick={() => onPick(preview, r.id)}
                  className="w-full text-left px-3 py-3 rounded-lg active:bg-slate-50 flex gap-3"
                >
                  <span className="text-xl shrink-0 mt-0.5">
                    {r.emoji || "⚡"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-slate-900 truncate">
                      {r.name}
                      {r.favorite && (
                        <span className="ml-1 text-amber-400">★</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 leading-snug line-clamp-2 mt-0.5">
                      {preview}
                    </p>
                  </div>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </BottomSheet>
  );
}

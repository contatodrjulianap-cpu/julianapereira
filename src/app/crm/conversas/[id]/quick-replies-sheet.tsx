"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
            aria-hidden
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 32 }}
            className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl shadow-xl pb-[max(env(safe-area-inset-bottom),12px)] max-h-[80vh] flex flex-col"
          >
            <div className="flex justify-center py-2 shrink-0">
              <span className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>
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

            <ul className="flex-1 overflow-y-auto px-2 pb-3">
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

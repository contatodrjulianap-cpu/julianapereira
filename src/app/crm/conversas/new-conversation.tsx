"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Hit = {
  id: string;
  name: string | null;
  phone: string;
  selfie_url: string | null;
  status: string | null;
};

function initials(name: string | null): string {
  const p = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export function NewConversationModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Busca com debounce simples.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/leads/search?q=${encodeURIComponent(term)}`);
        const data = await res.json();
        setHits(res.ok ? (data.leads ?? []) : []);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  function open(id: string) {
    router.push(`/crm/conversas/${id}`);
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <div onClick={onClose} className="absolute inset-0 bg-black/50" aria-hidden />
      <div className="absolute inset-x-0 top-0 md:inset-0 md:flex md:items-start md:justify-center md:pt-20">
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative bg-white md:rounded-2xl md:max-w-md w-full md:shadow-2xl min-h-[60vh] md:min-h-0 md:max-h-[70vh] flex flex-col"
        >
          <div className="sticky top-0 bg-[var(--sakura-cocoa,#3b2d28)] text-white px-4 py-3 flex items-center justify-between md:rounded-t-2xl">
            <h3 className="font-semibold text-sm">💬 Iniciar conversa</h3>
            <button onClick={onClose} className="text-white/80 hover:text-white text-xl leading-none">
              ×
            </button>
          </div>
          <div className="p-3 border-b border-slate-100">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="🔍 Buscar lead por nome ou telefone"
              className="w-full px-3 py-2.5 text-base bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-slate-900"
            />
            <p className="text-[11px] text-slate-400 mt-1.5 px-1">
              Acha qualquer lead (mesmo sem mensagem) e abre a conversa.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <p className="text-xs text-slate-400 text-center py-6">Buscando…</p>
            )}
            {!loading && q.trim().length >= 2 && hits.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">
                Nenhum lead encontrado.
              </p>
            )}
            <ul>
              {hits.map((h) => (
                <li key={h.id}>
                  <button
                    onClick={() => open(h.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 active:bg-slate-100 text-left border-b border-slate-50"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-semibold shrink-0">
                      {initials(h.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-slate-900 truncate">
                        {h.name ?? h.phone}
                      </p>
                      <p className="text-[12px] text-slate-500 truncate">{h.phone}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

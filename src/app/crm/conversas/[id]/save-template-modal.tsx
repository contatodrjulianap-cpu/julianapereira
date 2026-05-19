"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  firstNameOf,
  replaceNameWithVariable,
  interpolate,
} from "@/lib/template-vars";

export function SaveTemplateModal({
  open,
  originalText,
  leadFullName,
  onClose,
  onSaved,
}: {
  open: boolean;
  originalText: string;
  leadFullName: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const first = firstNameOf(leadFullName);
  const suggestion = first ? replaceNameWithVariable(originalText, first) : originalText;
  const hasNameMatch = suggestion !== originalText;

  const [useVariable, setUseVariable] = useState(hasNameMatch);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("⚡");
  const [favorite, setFavorite] = useState(false);
  const [body, setBody] = useState(hasNameMatch ? suggestion : originalText);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUseVariable(hasNameMatch);
      setName("");
      setEmoji("⚡");
      setFavorite(false);
      setBody(hasNameMatch ? suggestion : originalText);
      setErr(null);
    }
  }, [open, hasNameMatch, suggestion, originalText]);

  // Toggle do checkbox aplica/desfaz a substituição no body atual.
  // Se o user editou manualmente, preserva o que ele escreveu o máximo possível.
  function handleToggleVariable(next: boolean) {
    setUseVariable(next);
    if (next && first) {
      setBody((cur) => replaceNameWithVariable(cur, first));
    } else if (!next && first) {
      setBody((cur) => cur.replace(/\{primeiro_nome\}/g, first));
    }
  }

  const preview = interpolate(body, { primeiro_nome: first ?? undefined });

  async function save() {
    if (!name.trim()) {
      setErr("Dá um nome pro template.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/quick-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          emoji: emoji || "⚡",
          body,
          favorite,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "erro ao salvar");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "erro");
    } finally {
      setSaving(false);
    }
  }

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
            className="fixed inset-0 bg-black/40 z-50"
            aria-hidden
          />
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed inset-x-3 top-12 z-50 bg-white rounded-2xl shadow-2xl max-w-md mx-auto overflow-hidden"
          >
            <header className="px-5 pt-5 pb-2">
              <h3 className="text-base font-semibold text-slate-900">
                Salvar resposta rápida
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Vai virar template ⚡ pra reusar.
              </p>
            </header>

            <div className="px-5 pt-3 space-y-3">
              <div className="flex gap-2">
                <input
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
                  placeholder="⚡"
                  className="w-14 px-2 py-2 text-center text-xl bg-slate-100 rounded-lg outline-none"
                />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do template (ex: Enviar valores)"
                  className="flex-1 px-3 py-2 text-sm bg-slate-100 rounded-lg outline-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  Mensagem (pode editar)
                </span>
                {first && (
                  <button
                    type="button"
                    onClick={() =>
                      setBody((cur) =>
                        cur.includes("{primeiro_nome}")
                          ? cur
                          : `${cur} {primeiro_nome}`,
                      )
                    }
                    className="text-[10px] font-semibold text-[var(--sakura-cocoa,#3b2d28)] active:opacity-60"
                  >
                    + {"{primeiro_nome}"}
                  </button>
                )}
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none resize-none focus:border-[var(--sakura-cocoa,#3b2d28)]"
              />
              {hasNameMatch && (
                <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useVariable}
                    onChange={(e) => handleToggleVariable(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[var(--sakura-cocoa,#3b2d28)]"
                  />
                  <span>
                    Trocar &quot;{first}&quot; por{" "}
                    <code className="bg-slate-100 px-1 rounded">
                      {"{primeiro_nome}"}
                    </code>{" "}
                    (funciona pra qualquer lead)
                  </span>
                </label>
              )}

              {first && body.includes("{primeiro_nome}") && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    Prévia pro {first}:
                  </p>
                  <p className="text-sm text-slate-700 mt-1 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 whitespace-pre-wrap">
                    {preview}
                  </p>
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={favorite}
                  onChange={(e) => setFavorite(e.target.checked)}
                  className="w-4 h-4 accent-amber-400"
                />
                <span>★ Marcar como favorito</span>
              </label>

              {err && <p className="text-sm text-red-600">{err}</p>}
            </div>

            <footer className="px-5 pb-5 pt-4 flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg active:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-[var(--sakura-cocoa,#3b2d28)] rounded-lg disabled:opacity-40"
              >
                {saving ? "..." : "Salvar"}
              </button>
            </footer>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

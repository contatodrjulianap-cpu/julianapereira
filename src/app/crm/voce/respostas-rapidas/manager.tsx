"use client";

import { useState } from "react";

export type QuickReply = {
  id: string;
  name: string;
  emoji: string;
  body: string;
  category: string | null;
  favorite: boolean;
  uses_count: number;
};

export function QuickRepliesManager({ initial }: { initial: QuickReply[] }) {
  const [items, setItems] = useState<QuickReply[]>(initial);
  const [editing, setEditing] = useState<QuickReply | "new" | null>(null);

  async function refresh() {
    const res = await fetch("/api/quick-replies");
    const data = await res.json();
    setItems((data.replies as QuickReply[]) ?? []);
  }

  async function toggleFavorite(r: QuickReply) {
    const next = !r.favorite;
    setItems((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, favorite: next } : x)),
    );
    await fetch(`/api/quick-replies/${r.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: next }),
    });
  }

  async function remove(r: QuickReply) {
    if (!confirm(`Apagar "${r.name}"?`)) return;
    setItems((prev) => prev.filter((x) => x.id !== r.id));
    await fetch(`/api/quick-replies/${r.id}`, { method: "DELETE" });
  }

  return (
    <div>
      <button
        onClick={() => setEditing("new")}
        className="w-full mb-4 py-3 text-sm font-semibold text-white bg-[var(--sakura-cocoa,#3b2d28)] rounded-xl active:opacity-80"
      >
        + Novo template
      </button>

      {items.length === 0 ? (
        <div className="text-center py-12 text-sm text-slate-400">
          Nenhum template ainda. Crie o primeiro acima ou segure uma mensagem
          enviada na conversa.
        </div>
      ) : (
        <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {items.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0 mt-0.5">
                  {r.emoji || "⚡"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-900">
                    {r.name}
                  </p>
                  <p className="text-xs text-slate-500 leading-snug line-clamp-2 mt-0.5">
                    {r.body}
                  </p>
                  {r.uses_count > 0 && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Usado {r.uses_count}x
                    </p>
                  )}
                </div>
                <button
                  onClick={() => toggleFavorite(r)}
                  className="shrink-0 text-xl"
                  aria-label={r.favorite ? "Desfavoritar" : "Favoritar"}
                >
                  {r.favorite ? "★" : "☆"}
                </button>
              </div>
              <div className="flex gap-3 pt-2 mt-2 border-t border-slate-50">
                <button
                  onClick={() => setEditing(r)}
                  className="text-xs text-slate-600 active:opacity-60"
                >
                  Editar
                </button>
                <button
                  onClick={() => remove(r)}
                  className="text-xs text-red-500 active:opacity-60"
                >
                  Apagar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <EditModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}

function EditModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: QuickReply | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "⚡");
  const [body, setBody] = useState(initial?.body ?? "");
  const [favorite, setFavorite] = useState(initial?.favorite ?? false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!name.trim() || !body.trim()) {
      setErr("Nome e mensagem são obrigatórios.");
      return;
    }
    setSaving(true);
    setErr(null);
    const url = initial ? `/api/quick-replies/${initial.id}` : "/api/quick-replies";
    const method = initial ? "PUT" : "POST";
    try {
      const res = await fetch(url, {
        method,
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
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-10 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 pt-5 pb-2">
          <h3 className="text-base font-semibold text-slate-900">
            {initial ? "Editar template" : "Novo template"}
          </h3>
        </header>
        <div className="px-5 pt-3 space-y-3 pb-2">
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
              placeholder="Nome (ex: Enviar valores)"
              className="flex-1 px-3 py-2 text-sm bg-slate-100 rounded-lg outline-none"
              autoFocus
            />
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Mensagem... Use {primeiro_nome} pra personalizar."
            rows={6}
            className="w-full px-3 py-2 text-sm bg-slate-100 rounded-lg outline-none resize-none"
          />
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={favorite}
              onChange={(e) => setFavorite(e.target.checked)}
              className="w-4 h-4 accent-amber-400"
            />
            <span>★ Favorito (aparece primeiro)</span>
          </label>
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
        <footer className="px-5 pb-5 pt-2 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg"
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
      </div>
    </div>
  );
}

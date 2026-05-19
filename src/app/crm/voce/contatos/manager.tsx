"use client";

import { useState } from "react";

export type SavedContact = {
  id: string;
  name: string;
  phone: string;
  description: string | null;
  emoji: string;
  pinned: boolean;
};

export function ContactsManager({ initial }: { initial: SavedContact[] }) {
  const [items, setItems] = useState<SavedContact[]>(initial);
  const [editing, setEditing] = useState<SavedContact | "new" | null>(null);

  async function refresh() {
    const res = await fetch("/api/saved-contacts");
    const data = await res.json();
    setItems((data.contacts as SavedContact[]) ?? []);
  }

  async function togglePin(c: SavedContact) {
    const next = !c.pinned;
    setItems((p) => p.map((x) => (x.id === c.id ? { ...x, pinned: next } : x)));
    await fetch(`/api/saved-contacts/${c.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: next }),
    });
  }

  async function remove(c: SavedContact) {
    if (!confirm(`Apagar "${c.name}"?`)) return;
    setItems((p) => p.filter((x) => x.id !== c.id));
    await fetch(`/api/saved-contacts/${c.id}`, { method: "DELETE" });
  }

  return (
    <div>
      <button
        onClick={() => setEditing("new")}
        className="w-full mb-4 py-3 text-sm font-semibold text-white bg-[var(--sakura-cocoa,#3b2d28)] rounded-xl active:opacity-80"
      >
        + Novo contato
      </button>

      {items.length === 0 ? (
        <div className="text-center py-12 text-sm text-slate-400">
          Nenhum contato salvo ainda.
        </div>
      ) : (
        <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {items.map((c) => (
            <li key={c.id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0 mt-0.5">
                  {c.emoji || "👤"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-900">
                    {c.name}
                  </p>
                  <p className="text-xs text-slate-500">{c.phone}</p>
                  {c.description && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {c.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => togglePin(c)}
                  className="shrink-0 text-xl"
                  aria-label={c.pinned ? "Desafixar" : "Fixar"}
                >
                  {c.pinned ? "★" : "☆"}
                </button>
              </div>
              <div className="flex gap-3 pt-2 mt-2 border-t border-slate-50">
                <button
                  onClick={() => setEditing(c)}
                  className="text-xs text-slate-600 active:opacity-60"
                >
                  Editar
                </button>
                <button
                  onClick={() => remove(c)}
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
  initial: SavedContact | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "👤");
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!name.trim() || !phone.trim()) {
      setErr("Nome e telefone obrigatórios.");
      return;
    }
    setSaving(true);
    setErr(null);
    const url = initial
      ? `/api/saved-contacts/${initial.id}`
      : "/api/saved-contacts";
    const method = initial ? "PUT" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          description: description.trim() || null,
          emoji: emoji || "👤",
          pinned,
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
            {initial ? "Editar contato" : "Novo contato"}
          </h3>
        </header>
        <div className="px-5 pt-3 space-y-3 pb-2">
          <div className="flex gap-2">
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
              placeholder="👤"
              className="w-14 px-2 py-2 text-center text-xl bg-slate-100 rounded-lg outline-none"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome (ex: Recepção da Clínica)"
              className="flex-1 px-3 py-2 text-sm bg-slate-100 rounded-lg outline-none"
              autoFocus
            />
          </div>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Telefone com DDD (11999999999)"
            inputMode="tel"
            className="w-full px-3 py-2 text-sm bg-slate-100 rounded-lg outline-none"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição (opcional)"
            className="w-full px-3 py-2 text-sm bg-slate-100 rounded-lg outline-none"
          />
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
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

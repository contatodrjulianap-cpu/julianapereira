"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "../bottom-sheet";

export type SavedContact = {
  id: string;
  name: string;
  phone: string;
  description: string | null;
  emoji: string;
  pinned: boolean;
};

// Tipos pra Contact Picker API (Chrome Android). iOS/Safari não suportam.
type ContactInfo = { name?: string[]; tel?: string[] };
type ContactsManager = {
  select: (props: string[], opts?: { multiple?: boolean }) => Promise<ContactInfo[]>;
};
function hasContactPicker(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { contacts?: ContactsManager };
  return !!nav.contacts?.select;
}

export function ContactSheet({
  open,
  leadId,
  onClose,
  onSent,
}: {
  open: boolean;
  leadId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [mode, setMode] = useState<"list" | "manual">("list");
  const [saved, setSaved] = useState<SavedContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode("list");
    setName("");
    setPhone("");
    setErr(null);
    setLoading(true);
    fetch("/api/saved-contacts")
      .then((r) => r.json())
      .then((d) => setSaved((d.contacts as SavedContact[]) ?? []))
      .finally(() => setLoading(false));
  }, [open]);

  async function sendContact(contactName: string, contactPhone: string) {
    const clean = contactPhone.replace(/\D/g, "");
    if (!contactName.trim() || clean.length < 10) {
      setErr("Nome e telefone (DDD) são obrigatórios.");
      return;
    }
    setSending(true);
    setErr(null);
    try {
      const res = await fetch("/api/zapi/send-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          contact_name: contactName.trim(),
          contact_phone: clean,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "envio falhou");
      onSent();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "erro ao enviar");
    } finally {
      setSending(false);
    }
  }

  async function pickFromPhone() {
    if (!hasContactPicker()) {
      setMode("manual");
      return;
    }
    try {
      const nav = navigator as Navigator & { contacts?: ContactsManager };
      const list = await nav.contacts!.select(["name", "tel"], { multiple: false });
      const c = list[0];
      if (!c) return;
      const fullName = c.name?.[0] ?? "";
      const tel = c.tel?.[0] ?? "";
      setName(fullName);
      setPhone(tel);
      setMode("manual");
    } catch (e) {
      // user cancelou ou erro de permissão
      console.warn("contact picker", e);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="85vh">
      <header className="px-5 pb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">
          Compartilhar contato
        </h3>
        {mode === "manual" && (
          <button
            onClick={() => setMode("list")}
            className="text-xs text-slate-500"
          >
            ← Voltar
          </button>
        )}
      </header>

      {mode === "list" ? (
        <div className="px-3 pb-3">
          {/* Atalhos */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={pickFromPhone}
              className="flex flex-col items-center gap-1 py-3 px-2 bg-sky-50 rounded-xl active:bg-sky-100"
            >
              <span className="text-2xl">📱</span>
              <span className="text-[11px] font-semibold text-sky-700 text-center leading-tight">
                {hasContactPicker() ? "Do celular" : "Manual"}
              </span>
            </button>
            <button
              onClick={() => setMode("manual")}
              className="flex flex-col items-center gap-1 py-3 px-2 bg-slate-50 rounded-xl active:bg-slate-100"
            >
              <span className="text-2xl">✏️</span>
              <span className="text-[11px] font-semibold text-slate-700 text-center leading-tight">
                Digitar
              </span>
            </button>
          </div>

          {/* Contatos salvos */}
          <h4 className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            Contatos da clínica
            <a
              href="/crm/voce/contatos"
              className="text-[10px] font-normal text-slate-500"
            >
              Gerenciar
            </a>
          </h4>
          {loading ? (
            <p className="px-3 py-4 text-sm text-slate-400 text-center">
              Carregando...
            </p>
          ) : saved.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-400 text-center">
              Nenhum contato salvo ainda. Cadastra em{" "}
              <a href="/crm/voce/contatos" className="underline">
                Você → Contatos
              </a>
              .
            </p>
          ) : (
            <ul className="space-y-1">
              {saved.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => sendContact(c.name, c.phone)}
                    disabled={sending}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg active:bg-slate-50 disabled:opacity-50"
                  >
                    <span className="text-2xl shrink-0">{c.emoji || "👤"}</span>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-semibold text-sm text-slate-900 truncate">
                        {c.name}
                        {c.pinned && <span className="ml-1 text-amber-400">★</span>}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {c.description || c.phone}
                      </p>
                    </div>
                    <span className="text-slate-300">→</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {err && <p className="text-sm text-red-600 px-3 mt-3">{err}</p>}
        </div>
      ) : (
        // Mode manual: inputs
        <div className="px-4 pb-3 space-y-2">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
              Nome
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Dra. Juliana"
              className="mt-1 w-full px-3 py-2 text-sm bg-slate-100 rounded-lg outline-none"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
              Telefone (com DDD)
            </span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="11999999999"
              inputMode="tel"
              className="mt-1 w-full px-3 py-2 text-sm bg-slate-100 rounded-lg outline-none"
            />
          </label>

          {err && <p className="text-sm text-red-600">{err}</p>}

          <button
            onClick={() => sendContact(name, phone)}
            disabled={sending || !name.trim() || !phone.trim()}
            className="w-full mt-3 py-2.5 text-sm font-semibold text-white bg-[var(--sakura-cocoa,#3b2d28)] rounded-lg disabled:opacity-40"
          >
            {sending ? "Enviando..." : "Enviar contato"}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}

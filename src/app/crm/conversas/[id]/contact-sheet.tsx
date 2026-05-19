"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "../bottom-sheet";

// TODO: pegar de integration_config (admin edita em Você → Integrações).
const CLINIC_CONTACT = {
  name: "Clínica Sakura",
  phone: "11999999999",
};

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
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setPhone("");
      setErr(null);
    }
  }, [open]);

  async function send() {
    const cleanPhone = phone.replace(/\D/g, "");
    if (!name.trim()) {
      setErr("Nome do contato é obrigatório.");
      return;
    }
    if (cleanPhone.length < 10) {
      setErr("Telefone inválido (mínimo 10 dígitos).");
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
          contact_name: name.trim(),
          contact_phone: cleanPhone,
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

  function useClinic() {
    setName(CLINIC_CONTACT.name);
    setPhone(CLINIC_CONTACT.phone);
  }

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="80vh">
      <header className="px-5 pb-3">
        <h3 className="text-base font-semibold text-slate-900">
          Compartilhar contato
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Envia como cartão de contato direto no WhatsApp.
        </p>
      </header>

      <div className="px-4 pb-2">
        <button
          onClick={useClinic}
          className="w-full flex items-center gap-3 px-3 py-2.5 bg-emerald-50 rounded-lg active:bg-emerald-100 mb-3"
        >
          <span className="text-xl">🏥</span>
          <span className="flex-1 text-left">
            <span className="block text-[14px] font-semibold text-emerald-800">
              Usar contato da clínica
            </span>
            <span className="block text-[11px] text-emerald-600">
              {CLINIC_CONTACT.name} · {CLINIC_CONTACT.phone}
            </span>
          </span>
        </button>

        <div className="space-y-2">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
              Nome
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Dra. Juliana"
              className="mt-1 w-full px-3 py-2 text-sm bg-slate-100 rounded-lg outline-none"
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
        </div>

        {err && <p className="text-sm text-red-600 mt-3">{err}</p>}

        <button
          onClick={send}
          disabled={sending || !name.trim() || !phone.trim()}
          className="w-full mt-4 py-2.5 text-sm font-semibold text-white bg-[var(--sakura-cocoa,#3b2d28)] rounded-lg disabled:opacity-40 active:opacity-80"
        >
          {sending ? "Enviando..." : "Enviar contato"}
        </button>
      </div>
    </BottomSheet>
  );
}

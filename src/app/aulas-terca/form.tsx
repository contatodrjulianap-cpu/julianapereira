"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function AulaTercaForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const phone = normalizePhone(phoneDisplay);
    if (name.trim().length < 2) {
      setError("Digita seu nome completo.");
      return;
    }
    if (phone.length < 12) {
      setError("Digita o WhatsApp com DDD.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/aulas-terca/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Falha ao enviar");
      }
      router.push("/aulas-terca/obrigado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-stone-700">
          Seu nome
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-3 text-base text-stone-900 outline-none focus:border-rose-700 focus:ring-1 focus:ring-rose-700"
          placeholder="Dra. Maria Silva"
          required
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-stone-700">
          WhatsApp (com DDD)
        </label>
        <input
          id="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={phoneDisplay}
          onChange={(e) => setPhoneDisplay(formatPhoneDisplay(e.target.value))}
          className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-3 text-base text-stone-900 outline-none focus:border-rose-700 focus:ring-1 focus:ring-rose-700"
          placeholder="(11) 99999-9999"
          required
        />
      </div>

      {error && (
        <p className="text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-rose-700 px-5 py-3 text-base font-medium text-white hover:bg-rose-800 disabled:opacity-60"
      >
        {submitting ? "Enviando..." : "Entrar no grupo da terça"}
      </button>

      <p className="text-xs text-stone-500">
        Ao entrar, você recebe os avisos das próximas aulas. Pode sair quando
        quiser.
      </p>
    </form>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";

type State = "idle" | "submitting" | "success" | "error";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const KIWIFY_BASE = "https://pay.kiwify.com.br/oOqy3vF";
const PRODUCT_ID = "vlr-online";
const PRODUCT_NAME = "Viver de Lentes de Resina (VLR Online)";
const ORIGEM = "lp-aplicacao-vlr";

function formatPhoneInput(raw: string): string {
  const d = raw.replace(/\D+/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function validEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function collectUtmParams(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const qs = new URLSearchParams(window.location.search);
  const out: Record<string, string> = {};
  [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_id",
    "fbclid",
    "gclid",
    "gbraid",
    "wbraid",
    "msclkid",
    "ttclid",
    "li_fat_id",
    "src",
    "sck",
    "xcod",
    "ref",
  ].forEach((k) => {
    const v = qs.get(k);
    if (v) out[k] = v;
  });
  return out;
}

function buildKiwifyUrl(extra: Record<string, string>): string {
  try {
    const url = new URL(KIWIFY_BASE);
    Object.entries(extra).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    });
    return url.toString();
  } catch {
    return KIWIFY_BASE;
  }
}

export function LpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("vlr_lead") || "{}");
      if (saved.name) setName(saved.name);
      if (saved.email) setEmail(saved.email);
      if (saved.phone) setPhone(formatPhoneInput(saved.phone));
    } catch {}
  }, []);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmedName = name.trim();
      const trimmedEmail = email.trim();
      const phoneDigits = phone.replace(/\D+/g, "");

      const errs: Record<string, string> = {};
      if (trimmedName.length < 3) errs.name = "Digite seu nome completo";
      if (!validEmail(trimmedEmail)) errs.email = "E-mail inválido";
      if (phoneDigits.length < 10 || phoneDigits.length > 11)
        errs.phone = "WhatsApp inválido (DDD + número)";
      setErrors(errs);
      if (Object.keys(errs).length) return;

      setState("submitting");

      try {
        localStorage.setItem(
          "vlr_lead",
          JSON.stringify({ name: trimmedName, email: trimmedEmail, phone: phoneDigits }),
        );
      } catch {}

      const fbp = readCookie("_fbp");
      const fbc = readCookie("_fbc");
      const utms = collectUtmParams();
      const pageUrl = typeof window !== "undefined" ? window.location.href : null;
      const referrer = typeof document !== "undefined" ? document.referrer : null;

      try {
        const res = await fetch("/api/lp/kiwify-capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            email: trimmedEmail,
            phone: phoneDigits,
            origem: ORIGEM,
            product_id: PRODUCT_ID,
            product_name: PRODUCT_NAME,
            cta_position: ORIGEM,
            fbp,
            fbc,
            page_url: pageUrl,
            referrer,
            utms,
          }),
          keepalive: true,
        });

        const data = await res.json().catch(() => ({}));
        const eventId = data?.event_id;

        if (typeof window !== "undefined" && window.fbq && eventId) {
          window.fbq(
            "track",
            "InitiateCheckout",
            {
              content_name: PRODUCT_NAME,
              content_category: ORIGEM,
              content_ids: [PRODUCT_ID],
              currency: "BRL",
            },
            { eventID: eventId },
          );
        }

        setState("success");
        const dest = buildKiwifyUrl({
          name: trimmedName,
          email: trimmedEmail,
          phone: phoneDigits,
          ...utms,
          ...(eventId ? { event_id: eventId } : {}),
        });
        window.location.href = dest;
      } catch {
        // Mesmo se o POST falhar (rede), segue pro checkout — não trava o cliente.
        setState("success");
        const dest = buildKiwifyUrl({
          name: trimmedName,
          email: trimmedEmail,
          phone: phoneDigits,
          ...utms,
        });
        window.location.href = dest;
      }
    },
    [name, email, phone],
  );

  const disabled = state === "submitting" || state === "success";

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field
        label="Nome completo"
        id="vlr-name"
        type="text"
        autoComplete="name"
        value={name}
        onChange={setName}
        disabled={disabled}
        error={errors.name}
        placeholder="Seu nome completo"
      />
      <Field
        label="E-mail"
        id="vlr-email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={setEmail}
        disabled={disabled}
        error={errors.email}
        placeholder="seu@email.com"
      />
      <Field
        label="WhatsApp (com DDD)"
        id="vlr-phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        value={phone}
        onChange={(v) => setPhone(formatPhoneInput(v))}
        disabled={disabled}
        error={errors.phone}
        placeholder="(11) 91234-5678"
      />

      <button
        type="submit"
        disabled={disabled}
        className="w-full mt-2 py-4 rounded-md font-bold text-[13px] tracking-[1.5px] uppercase transition disabled:opacity-65 disabled:cursor-wait hover:opacity-90"
        style={{
          background: "#F5B521",
          color: "#0A0A0A",
        }}
      >
        {state === "submitting"
          ? "Processando…"
          : state === "success"
            ? "Redirecionando…"
            : "Continuar com a aplicação →"}
      </button>
    </form>
  );
}

function Field({
  label,
  id,
  type,
  autoComplete,
  inputMode,
  value,
  onChange,
  error,
  placeholder,
  disabled,
}: {
  label: string;
  id: string;
  type: string;
  autoComplete?: string;
  inputMode?: "tel" | "email" | "text";
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[11px] uppercase tracking-[2px] font-semibold mb-1.5"
        style={{ color: "#F4E4B8" }}
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required
        className="w-full px-4 py-3 rounded-md text-base focus:outline-none focus:ring-2 transition disabled:opacity-60"
        style={{
          background: "#0A0A0A",
          border: `1px solid ${error ? "#EF4444" : "#3F3F46"}`,
          color: "#FFFFFF",
        }}
      />
      {error && (
        <p className="text-xs mt-1" style={{ color: "#EF4444" }}>
          {error}
        </p>
      )}
    </div>
  );
}

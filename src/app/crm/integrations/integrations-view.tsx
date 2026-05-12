"use client";

import { useState } from "react";
import type { IntegrationConfig } from "@/lib/integration-config";
import { renderGreeting } from "@/lib/integration-config";

type Archetype = "PRONTA" | "ESPERANCOSA" | "CETICA";
const ARCH_LIST: Archetype[] = ["PRONTA", "ESPERANCOSA", "CETICA"];

const ARCH_LABEL: Record<Archetype, string> = {
  PRONTA: "🔥 Pronta",
  ESPERANCOSA: "🟡 Esperançosa",
  CETICA: "📍 Cética",
};

function fmtArchetypes(list: Archetype[] | undefined): string {
  if (!list) return "todos arquétipos";
  if (list.length === 0) return "⚠️ nenhum arquétipo";
  if (list.length === ARCH_LIST.length) return "todos arquétipos";
  return list.map((a) => ARCH_LABEL[a]).join(" + ");
}

const ARCH_HINT: Record<Archetype, string> = {
  PRONTA:
    "Lead quente — decisão tomada. Mensagem de boas-vindas + alinhar agenda.",
  ESPERANCOSA:
    "Lead morno — quer entender investimento. Mensagem de orientação.",
  CETICA:
    "Lead frio — geralmente vai pro Instagram. WhatsApp desligado por padrão.",
};

const FB_TRIGGERS = [
  {
    key: "pageview" as const,
    label: "Pageview do quiz",
    desc: "Dispara quando alguém abre /quiz pela primeira vez na sessão.",
    suggested: "PageView",
    archetypeFilter: false,
  },
  {
    key: "quiz_submit" as const,
    label: "Quiz submetido (lead criado)",
    desc: "Dispara quando user finaliza as 8 perguntas + entrega contato.",
    suggested: "Lead",
    archetypeFilter: true,
  },
  {
    key: "wa_click" as const,
    label: "Click no WhatsApp",
    desc: "Dispara quando lead clica no botão pra ir pro WhatsApp da Ju.",
    suggested: "AddToCart",
    archetypeFilter: true,
  },
];

const FB_EVENT_NAMES = [
  "PageView",
  "ViewContent",
  "Lead",
  "AddToCart",
  "InitiateCheckout",
  "Contact",
  "CompleteRegistration",
  "Purchase",
  "Schedule",
];

export function IntegrationsView({
  initialConfig,
}: {
  initialConfig: IntegrationConfig;
}) {
  const [config, setConfig] = useState<IntegrationConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  function patchGreeting(arch: Archetype, patch: Partial<{ enabled: boolean; message: string }>) {
    setConfig((c) => ({
      ...c,
      whatsapp: {
        ...c.whatsapp,
        greetings: {
          ...c.whatsapp.greetings,
          [arch]: { ...c.whatsapp.greetings[arch], ...patch },
        },
      },
    }));
    setDirty(true);
  }

  function patchFb(
    key: keyof IntegrationConfig["facebook"],
    patch: Partial<IntegrationConfig["facebook"][typeof key]>,
  ) {
    setConfig((c) => ({
      ...c,
      facebook: {
        ...c.facebook,
        [key]: { ...c.facebook[key], ...patch },
      },
    }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/integration/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.issues
          ? `Validação: ${data.issues.map((i: { path: unknown[]; message: string }) => `${i.path.join(".")}: ${i.message}`).join(" · ")}`
          : data.error ?? "erro";
        throw new Error(msg);
      }
      setSavedAt(new Date().toLocaleTimeString("pt-BR"));
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "erro");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    if (!confirm("Descartar mudanças?")) return;
    setConfig(initialConfig);
    setDirty(false);
    setError(null);
  }

  return (
    <div className="max-w-[1280px] mx-auto px-5 lg:px-8 py-6 w-full">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Integrações</h2>
          <p className="text-sm text-slate-500">
            WhatsApp (Z-API) + Facebook Conversions API · live após salvar
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
              Mudanças não salvas
            </span>
          )}
          {savedAt && !dirty && (
            <span className="text-xs text-emerald-700">✓ salvo às {savedAt}</span>
          )}
          {dirty && (
            <button
              onClick={reset}
              className="px-3 py-2 text-sm rounded-md border border-slate-200 hover:border-slate-400"
            >
              Descartar
            </button>
          )}
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="px-4 py-2 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {saving ? "Salvando..." : "💾 Salvar"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* Tabela estática: o que dispara HOJE */}
      <DisparosAtuaisTable config={config} />

      {/* WhatsApp */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">💬</span>
          <h3 className="text-lg font-bold">Automações WhatsApp (Z-API)</h3>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Mensagem inicial enviada via Z-API logo após o lead finalizar o quiz.
          Use <code className="bg-slate-100 px-1 rounded">{"{name}"}</code> pra
          substituir pelo primeiro nome do lead.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {ARCH_LIST.map((arch) => (
            <GreetingCard
              key={arch}
              archetype={arch}
              greeting={config.whatsapp.greetings[arch]}
              onChange={(p) => patchGreeting(arch, p)}
            />
          ))}
        </div>
      </section>

      {/* Facebook */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">📘</span>
          <h3 className="text-lg font-bold">Eventos Facebook (Conversions API)</h3>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Pixel ID + Token + dataset estão nas env vars do Vercel (read-only por
          aqui). Liga/desliga por trigger e ajusta o nome do evento padrão do FB.
        </p>
        <div className="space-y-3">
          {FB_TRIGGERS.map((t) => (
            <FbEventCard
              key={t.key}
              trigger={t}
              event={config.facebook[t.key]}
              onChange={(p) => patchFb(t.key, p)}
            />
          ))}
        </div>
      </section>

      <p className="text-xs text-slate-400 text-center">
        Integrações ativas em produção · /api/quiz/submit + /api/track lêem
        essa config a cada request.
      </p>
    </div>
  );
}

// =================================================
// GreetingCard
// =================================================

function GreetingCard({
  archetype,
  greeting,
  onChange,
}: {
  archetype: Archetype;
  greeting: { enabled: boolean; message: string };
  onChange: (patch: Partial<{ enabled: boolean; message: string }>) => void;
}) {
  const accent =
    archetype === "PRONTA"
      ? "bg-green-50 border-green-200"
      : archetype === "ESPERANCOSA"
        ? "bg-amber-50 border-amber-200"
        : "bg-slate-50 border-slate-300";

  return (
    <div className={`rounded-md border p-4 ${accent}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-wider font-bold">
          {ARCH_LABEL[archetype]}
        </p>
        <ToggleSwitch
          checked={greeting.enabled}
          onChange={(v) => onChange({ enabled: v })}
        />
      </div>
      <p className="text-[11px] text-slate-600 mb-3 italic">
        {ARCH_HINT[archetype]}
      </p>
      <textarea
        value={greeting.message}
        onChange={(e) => onChange({ message: e.target.value })}
        rows={6}
        disabled={!greeting.enabled}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {greeting.enabled && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-900">
            👁 Preview
          </summary>
          <div className="mt-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded text-[12px] text-slate-700 whitespace-pre-wrap">
            {renderGreeting(greeting.message, "Maria")}
          </div>
        </details>
      )}
    </div>
  );
}

// =================================================
// FbEventCard
// =================================================

function FbEventCard({
  trigger,
  event,
  onChange,
}: {
  trigger: {
    key: string;
    label: string;
    desc: string;
    suggested: string;
    archetypeFilter: boolean;
  };
  event: {
    enabled: boolean;
    event_name: string;
    content_name?: string;
    archetypes?: Archetype[];
  };
  onChange: (
    patch: Partial<{
      enabled: boolean;
      event_name: string;
      content_name: string;
      archetypes: Archetype[] | undefined;
    }>,
  ) => void;
}) {
  // undefined = todos disparam (back-compat). Lista = só os listados disparam.
  const allowAll = event.archetypes === undefined;
  const allowed = new Set(event.archetypes ?? ARCH_LIST);

  function toggleArchetype(a: Archetype) {
    if (allowAll) {
      // Sai do modo "todos" pra lista explícita sem o que clicou.
      onChange({ archetypes: ARCH_LIST.filter((x) => x !== a) });
      return;
    }
    const next = new Set(allowed);
    if (next.has(a)) next.delete(a);
    else next.add(a);
    onChange({ archetypes: Array.from(next) });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-md p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-slate-900">{trigger.label}</p>
          <p className="text-[12px] text-slate-500">{trigger.desc}</p>
        </div>
        <ToggleSwitch
          checked={event.enabled}
          onChange={(v) => onChange({ enabled: v })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
            Evento padrão FB
          </span>
          <select
            value={event.event_name}
            onChange={(e) => onChange({ event_name: e.target.value })}
            disabled={!event.enabled}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md disabled:opacity-50"
          >
            {FB_EVENT_NAMES.map((n) => (
              <option key={n} value={n}>
                {n}
                {n === trigger.suggested ? " (recomendado)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
            content_name
          </span>
          <input
            value={event.content_name ?? ""}
            onChange={(e) => onChange({ content_name: e.target.value })}
            disabled={!event.enabled}
            placeholder="ex: quiz_pageview"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md disabled:opacity-50"
          />
        </label>
      </div>

      {trigger.archetypeFilter && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
              Disparar para arquétipos
            </span>
            <button
              type="button"
              onClick={() =>
                onChange({ archetypes: allowAll ? [...ARCH_LIST] : undefined })
              }
              disabled={!event.enabled}
              className="text-[11px] text-slate-500 hover:text-slate-900 underline disabled:opacity-50"
            >
              {allowAll ? "definir lista" : "voltar a todos"}
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {ARCH_LIST.map((a) => {
              const on = allowAll || allowed.has(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleArchetype(a)}
                  disabled={!event.enabled}
                  className={`px-2.5 py-1 rounded-full text-[11px] border transition ${
                    on
                      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                      : "bg-slate-50 border-slate-200 text-slate-400 line-through"
                  } disabled:opacity-50`}
                >
                  {ARCH_LABEL[a]}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            {allowAll
              ? "Sem filtro — todos os arquétipos disparam o evento."
              : allowed.size === 0
                ? "⚠️ Lista vazia — nenhum arquétipo dispara."
                : `Só ${Array.from(allowed).join(" + ")} disparam.`}
          </p>
        </div>
      )}
    </div>
  );
}

// =================================================
// DisparosAtuaisTable — read-only resumo do que está
// disparando hoje (lê do config). Tabela estática.
// =================================================

function DisparosAtuaisTable({ config }: { config: IntegrationConfig }) {
  type Row = {
    icon: string;
    when: string;
    what: string;
    status: "ativo" | "desligado" | "sempre";
    delay: string;
  };

  const rows: Row[] = [
    {
      icon: "📱",
      when: "Lead finaliza quiz · 🔥 PRONTA",
      what: "Greeting WhatsApp via Z-API",
      status: config.whatsapp.greetings.PRONTA.enabled ? "ativo" : "desligado",
      delay: "imediato",
    },
    {
      icon: "📱",
      when: "Lead finaliza quiz · 🟡 ESPERANCOSA",
      what: "Greeting WhatsApp via Z-API",
      status: config.whatsapp.greetings.ESPERANCOSA.enabled
        ? "ativo"
        : "desligado",
      delay: "imediato",
    },
    {
      icon: "📱",
      when: "Lead finaliza quiz · 📍 CETICA",
      what: "Greeting WhatsApp (geralmente vai pro Instagram)",
      status: config.whatsapp.greetings.CETICA.enabled ? "ativo" : "desligado",
      delay: "imediato",
    },
    {
      icon: "💬",
      when: "Você digita no /crm/Conversas",
      what: "Envio manual via /api/zapi/send",
      status: "sempre",
      delay: "imediato",
    },
    {
      icon: "📘",
      when: "User abre /quiz",
      what: `FB CAPI → ${config.facebook.pageview.event_name}`,
      status: config.facebook.pageview.enabled ? "ativo" : "desligado",
      delay: "imediato",
    },
    {
      icon: "📘",
      when: `Lead finaliza quiz · ${fmtArchetypes(config.facebook.quiz_submit.archetypes)}`,
      what: `FB CAPI → ${config.facebook.quiz_submit.event_name}`,
      status: config.facebook.quiz_submit.enabled ? "ativo" : "desligado",
      delay: "imediato",
    },
    {
      icon: "📘",
      when: `Lead clica WhatsApp na tela de resultado · ${fmtArchetypes(config.facebook.wa_click.archetypes)}`,
      what: `FB CAPI → ${config.facebook.wa_click.event_name}`,
      status: config.facebook.wa_click.enabled ? "ativo" : "desligado",
      delay: "imediato",
    },
  ];

  return (
    <section className="bg-white border border-slate-200 rounded-md overflow-hidden mb-6">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold">🚀 Disparos ativos hoje</h3>
          <p className="text-[11px] text-slate-500">
            Tudo é síncrono · sem delay · sem follow-up automático (ainda).
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
          read-only
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2 text-left font-semibold w-8"></th>
              <th className="px-3 py-2 text-left font-semibold">Quando dispara</th>
              <th className="px-3 py-2 text-left font-semibold">O que acontece</th>
              <th className="px-3 py-2 text-left font-semibold w-24">Delay</th>
              <th className="px-3 py-2 text-left font-semibold w-28">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="px-3 py-2 text-lg">{r.icon}</td>
                <td className="px-3 py-2 text-slate-800">{r.when}</td>
                <td className="px-3 py-2 text-slate-600">{r.what}</td>
                <td className="px-3 py-2 text-[12px] text-slate-500">
                  {r.delay}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      r.status === "ativo"
                        ? "bg-emerald-100 text-emerald-800"
                        : r.status === "sempre"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {r.status === "sempre" ? "sempre on" : r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition shrink-0 ${
        checked ? "bg-emerald-500" : "bg-slate-300"
      }`}
      aria-label="Toggle"
      type="button"
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : ""
        }`}
      />
    </button>
  );
}

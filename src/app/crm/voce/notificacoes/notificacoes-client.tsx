"use client";

import { useEffect, useState } from "react";
import {
  getPushState,
  subscribePush,
  unsubscribePush,
  sendTestPush,
  type PushState,
} from "@/lib/push-client";

export function NotificacoesClient() {
  const [state, setState] = useState<PushState | "loading">("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    setState(await getPushState());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleEnable() {
    setBusy(true);
    setMsg(null);
    const res = await subscribePush();
    if (!res.ok) setMsg(`Falhou: ${res.reason}`);
    else setMsg("Notificações ativadas! Disparando teste…");
    await refresh();
    if (res.ok) await sendTestPush();
    setBusy(false);
  }

  async function handleDisable() {
    setBusy(true);
    setMsg(null);
    await unsubscribePush();
    await refresh();
    setMsg("Notificações desativadas.");
    setBusy(false);
  }

  async function handleTest() {
    setBusy(true);
    setMsg(null);
    const res = await sendTestPush();
    setMsg(res.ok ? "Push de teste enviado." : `Erro: ${JSON.stringify(res.detail)}`);
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="font-cormorant text-3xl font-semibold text-stone-800">
        🔔 Notificações de leads quentes
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        Ative pra receber alerta no celular toda vez que cair lead{" "}
        <strong className="text-rose-700">PRONTA</strong> ou{" "}
        <strong className="text-amber-700">ESPERANCOSA</strong>. Meta: cair em até
        15 minutos.
      </p>

      <div className="mt-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <StateBadge state={state} />

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {state === "permission-default" || state === "permission-granted" ? (
            <button
              onClick={handleEnable}
              disabled={busy}
              className="rounded-lg bg-amber-700 px-4 py-2.5 font-medium text-white shadow-sm hover:bg-amber-800 disabled:opacity-50"
            >
              {busy ? "Ativando…" : "🔔 Ativar notificações"}
            </button>
          ) : null}

          {state === "subscribed" ? (
            <>
              <button
                onClick={handleTest}
                disabled={busy}
                className="rounded-lg bg-amber-700 px-4 py-2.5 font-medium text-white shadow-sm hover:bg-amber-800 disabled:opacity-50"
              >
                {busy ? "Enviando…" : "🧪 Enviar teste"}
              </button>
              <button
                onClick={handleDisable}
                disabled={busy}
                className="rounded-lg border border-stone-300 px-4 py-2.5 font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                Desativar
              </button>
            </>
          ) : null}
        </div>

        {msg ? (
          <p className="mt-4 rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-700">
            {msg}
          </p>
        ) : null}
      </div>

      <details className="mt-6 rounded-xl border border-stone-200 bg-white p-5 text-sm">
        <summary className="cursor-pointer font-medium text-stone-700">
          📱 Como instalar no iPhone (precisa fazer 1x)
        </summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-stone-600">
          <li>Abra o CRM no <strong>Safari</strong> (não Chrome).</li>
          <li>Toque no botão <strong>compartilhar</strong> (quadrado com seta).</li>
          <li>Role e toque em <strong>“Adicionar à Tela de Início”</strong>.</li>
          <li>Confirme o nome “Sakura CRM” e toque em <strong>Adicionar</strong>.</li>
          <li>Abra o app pelo ícone na tela inicial (não pelo Safari).</li>
          <li>Volte a esta página e toque em <strong>Ativar notificações</strong>.</li>
        </ol>
        <p className="mt-3 text-stone-500">
          Sem esses passos no iPhone, o Apple não deixa receber notificação. É
          chato mas é uma vez só.
        </p>
      </details>
    </div>
  );
}

function StateBadge({ state }: { state: PushState | "loading" }) {
  const config: Record<typeof state, { label: string; color: string; hint: string }> = {
    loading: { label: "Carregando…", color: "bg-stone-100 text-stone-600", hint: "" },
    unsupported: {
      label: "❌ Não suportado",
      color: "bg-red-100 text-red-700",
      hint: "Seu navegador não suporta notificações push. Tente Chrome/Safari atualizado.",
    },
    "needs-pwa-ios": {
      label: "⚠️ Precisa instalar como app",
      color: "bg-amber-100 text-amber-800",
      hint: "No iPhone só funciona se adicionar à tela inicial primeiro. Veja instruções abaixo.",
    },
    "permission-default": {
      label: "🔕 Inativo",
      color: "bg-stone-100 text-stone-700",
      hint: "Toque em ativar pra receber alertas de lead quente.",
    },
    "permission-granted": {
      label: "🔕 Permissão dada, mas sem inscrição",
      color: "bg-amber-100 text-amber-800",
      hint: "Toque em ativar pra completar.",
    },
    "permission-denied": {
      label: "🚫 Permissão negada",
      color: "bg-red-100 text-red-700",
      hint: "Vá nas configurações do navegador, libere notificações pra clinicasakura.org e recarregue.",
    },
    subscribed: {
      label: "🔔 Ativo",
      color: "bg-emerald-100 text-emerald-800",
      hint: "Você recebe alerta de PRONTA/ESPERANCOSA. Pode mandar teste pra confirmar.",
    },
  };
  const c = config[state];
  return (
    <div>
      <div className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${c.color}`}>
        {c.label}
      </div>
      {c.hint ? <p className="mt-2 text-sm text-stone-600">{c.hint}</p> : null}
    </div>
  );
}

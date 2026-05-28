"use client";

import { useEffect } from "react";

export default function AdsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[/crm/ads] runtime error", error);
  }, [error]);

  return (
    <div className="flex-1 max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-lg font-semibold text-red-700">
        ⚠️ Erro carregando a página de Ads
      </h1>
      <p className="text-sm text-slate-600 mt-2">
        Algo travou na renderização. Detalhe técnico abaixo:
      </p>
      <pre className="mt-3 rounded-lg bg-slate-100 p-3 text-[11px] text-slate-800 whitespace-pre-wrap break-words font-mono">
        {error.message || "(sem mensagem)"}
        {error.digest && `\n\ndigest: ${error.digest}`}
        {error.stack && `\n\nstack:\n${error.stack.split("\n").slice(0, 8).join("\n")}`}
      </pre>
      <div className="mt-4 flex gap-2">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-900 text-white"
        >
          Tentar de novo
        </button>
        <a
          href="/crm"
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 text-slate-700"
        >
          ← Voltar pro CRM
        </a>
      </div>
      <p className="text-[10px] text-slate-400 mt-4">
        Manda o digest pro Lucas se persistir — ele acha os logs no Vercel
        usando esse código.
      </p>
    </div>
  );
}

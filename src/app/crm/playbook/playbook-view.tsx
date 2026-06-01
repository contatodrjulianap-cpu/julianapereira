"use client";

import { useState } from "react";
import {
  SOBRE_SAKURA,
  SEQUENCIA,
  FOLLOWUP,
  REGRAS,
  METRICAS,
  POP,
  LINKS,
} from "./playbook-data";

type Tab =
  | "sobre"
  | "pop"
  | "sequencia"
  | "objecoes"
  | "pacto"
  | "fechamento"
  | "followup"
  | "regras"
  | "metricas";

const TABS: { id: Tab; label: string; count?: number }[] = [
  { id: "sobre", label: "🌸 Sobre" },
  { id: "pop", label: "📱 Passo-a-passo", count: POP.length },
  { id: "sequencia", label: "🎯 Sequência", count: SEQUENCIA.length },
  { id: "objecoes", label: "🔑 Objeções" },
  { id: "pacto", label: "📌 Pacto final" },
  { id: "fechamento", label: "✅ Fechamento" },
  { id: "followup", label: "🔁 Follow-up", count: FOLLOWUP.length },
  { id: "regras", label: "⚠️ Regras", count: REGRAS.length },
  { id: "metricas", label: "📊 Métricas", count: METRICAS.length },
];

export default function PlaybookView() {
  const [tab, setTab] = useState<Tab>("sobre");
  const [copied, setCopied] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  function copy(id: string, text: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const q = search.trim().toLowerCase();
  const filterText = (s: string) => !q || s.toLowerCase().includes(q);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="px-4 sm:px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-10">
        <p className="text-[10px] tracking-[0.28em] uppercase font-bold text-rose-700">
          Playbook v2 · Clínica Sakura
        </p>
        <h1 className="text-xl font-semibold text-slate-900 mt-1">
          Manual de vendas das atendentes
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Como atender, vender e não deixar lead esfriar. Bola pra Milena e
          Gabi rodarem todo dia.
        </p>
      </header>

      <div className="px-4 sm:px-6 pt-4 pb-3 bg-white">
        <input
          type="search"
          placeholder="Buscar mensagem, regra, etapa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 rounded-md text-sm bg-slate-50 border border-slate-200 outline-none focus:border-rose-300"
        />
      </div>

      {/* Tabs */}
      <div className="px-4 sm:px-6 mb-4 overflow-x-auto bg-white border-b border-slate-200">
        <div className="flex gap-2 whitespace-nowrap pb-3 pt-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition ${
                tab === t.id
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span
                  className={`ml-1.5 text-[10px] ${
                    tab === t.id ? "text-white/70" : "text-slate-400"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 space-y-6">
        {tab === "sobre" && <SobreTab />}
        {tab === "pop" && <POPTab />}
        {tab === "sequencia" && (
          <SequenciaTab filterText={filterText} copy={copy} copied={copied} />
        )}
        {tab === "objecoes" && <ObjecoesTab copy={copy} copied={copied} />}
        {tab === "pacto" && <PactoTab copy={copy} copied={copied} />}
        {tab === "fechamento" && <FechamentoTab copy={copy} copied={copied} />}
        {tab === "followup" && <FollowupTab copy={copy} copied={copied} />}
        {tab === "regras" && <RegrasTab filterText={filterText} />}
        {tab === "metricas" && <MetricasTab />}
      </div>
    </main>
  );
}

// ========== TAB CONTENT ==========

function SobreTab() {
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-sm font-semibold text-slate-900 mb-2">
          🌸 Clínica Sakura — Dra. Juliana Pereira
        </h2>
        <p className="text-sm text-slate-700 leading-relaxed">
          {SOBRE_SAKURA.resumo}
        </p>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-slate-900 mb-2">
          🎯 Quem é o público
        </h3>
        <ul className="space-y-1.5">
          {SOBRE_SAKURA.publico.map((p) => (
            <li key={p} className="text-sm text-slate-700 flex gap-2">
              <span className="text-rose-500">•</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-slate-900 mb-2">
          ✨ Diferenciais (use no plantio durante a investigação)
        </h3>
        <ul className="space-y-1.5">
          {SOBRE_SAKURA.diferenciais.map((d) => (
            <li key={d} className="text-sm text-slate-700 flex gap-2">
              <span className="text-amber-500">•</span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-slate-900 mb-2">
          💰 Faixas de investimento
        </h3>
        <div className="space-y-1.5 text-sm">
          <p>
            <strong className="text-slate-900">Resina:</strong>{" "}
            <span className="text-slate-600">{SOBRE_SAKURA.tickets.resina}</span>
          </p>
          <p>
            <strong className="text-slate-900">Porcelana:</strong>{" "}
            <span className="text-slate-600">
              {SOBRE_SAKURA.tickets.porcelana}
            </span>
          </p>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-slate-900 mb-2">
          📍 Endereço da clínica
        </h3>
        <p className="text-sm text-slate-700">{SOBRE_SAKURA.endereco}</p>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-slate-900 mb-2">
          🔗 Links úteis
        </h3>
        <ul className="space-y-1.5 text-sm">
          {Object.entries(LINKS).map(([k, url]) => (
            <li key={k}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-rose-600 hover:underline break-all"
              >
                {url}
              </a>
              <span className="text-slate-400 text-xs ml-2">({k})</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function POPTab() {
  return (
    <div className="space-y-5">
      <Card variant="rose">
        <p className="text-sm text-rose-900">
          📱 <strong>Passo-a-passo de como usar o CRM no dia a dia.</strong>{" "}
          Cada etapa tem print (mobile + desktop) — quando os prints estiverem
          prontos, vão aparecer aqui automaticamente.
        </p>
      </Card>

      {POP.map((etapa) => (
        <Card key={etapa.n}>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-bold text-rose-500">{etapa.n}</span>
            <h3 className="text-base font-semibold text-slate-900">
              {etapa.titulo}
            </h3>
          </div>
          <p className="text-xs text-slate-500 italic mb-3">
            O que você vê: {etapa.o_que_voce_ve}
          </p>
          <ol className="space-y-2 mb-3">
            {etapa.passos.map((p, i) => (
              <li
                key={i}
                className="text-sm text-slate-700 flex gap-2 leading-relaxed"
              >
                <span className="shrink-0 w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <PrintSlot src={etapa.print_desktop} label="Desktop" />
            <PrintSlot src={etapa.print_mobile} label="Mobile" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function PrintSlot({ src, label }: { src: string; label: string }) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div className="aspect-video bg-slate-100 border-2 border-dashed border-slate-300 rounded-md flex flex-col items-center justify-center text-slate-400 text-[11px] p-2">
        <span className="text-2xl mb-1">📷</span>
        <span className="font-semibold">{label}</span>
        <span className="text-[10px] text-slate-400 mt-0.5 break-all text-center">
          {src}
        </span>
      </div>
    );
  }

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-md overflow-hidden border border-slate-200 hover:border-slate-300 transition relative group"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label}
        onError={() => setErrored(true)}
        className="w-full h-auto block bg-slate-50"
      />
      <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
        {label}
      </span>
    </a>
  );
}

function SequenciaTab({
  filterText,
  copy,
  copied,
}: {
  filterText: (s: string) => boolean;
  copy: (id: string, text: string) => void;
  copied: string | null;
}) {
  return (
    <div className="space-y-4">
      {SEQUENCIA.map((bloco) => (
        <Card key={bloco.id}>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-xl">{bloco.emoji}</span>
            <h3 className="text-base font-semibold text-slate-900">
              {bloco.titulo}
            </h3>
          </div>
          <p className="text-xs text-rose-700 font-semibold mb-1">
            QUANDO: <span className="font-normal text-slate-600">{bloco.quando}</span>
          </p>
          <p className="text-xs text-slate-600 mb-3 leading-relaxed">
            <strong className="text-slate-800">O que fazer:</strong>{" "}
            {bloco.o_que_fazer}
          </p>
          {bloco.regra && (
            <p className="text-xs bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded mb-3">
              ⚠️ <strong>Regra:</strong> {bloco.regra}
            </p>
          )}
          <div className="space-y-2">
            {bloco.mensagens
              .filter((m) => filterText(m.titulo) || filterText(m.texto))
              .map((m, i) => {
                const id = `${bloco.id}-${i}`;
                return (
                  <MsgCard
                    key={id}
                    id={id}
                    titulo={m.titulo}
                    texto={m.texto}
                    nota={m.nota}
                    onCopy={copy}
                    copied={copied}
                  />
                );
              })}
          </div>
        </Card>
      ))}
    </div>
  );
}

function ObjecoesTab({
  copy,
  copied,
}: {
  copy: (id: string, text: string) => void;
  copied: string | null;
}) {
  const b3 = SEQUENCIA.find((b) => b.id === "b3");
  if (!b3) return null;
  return (
    <div className="space-y-4">
      <Card variant="rose">
        <h3 className="text-sm font-bold text-rose-900 mb-1">
          ⚠️ A lacuna #1 do v1: parar no M1
        </h3>
        <p className="text-sm text-rose-800 leading-relaxed">
          Hoje quando lead diz "tá caro", você manda "Entendo, exige
          planejamento emocional e financeiro" e o lead some. O playbook v2
          obriga seguir IMEDIATAMENTE pro M2 (a pergunta de isolamento).
          Sem isolar, você responde no escuro.
        </p>
      </Card>
      {b3.mensagens.map((m, i) => (
        <MsgCard
          key={i}
          id={`obj-${i}`}
          titulo={m.titulo}
          texto={m.texto}
          nota={m.nota}
          onCopy={copy}
          copied={copied}
          highlight={m.titulo.includes("CRÍTICA")}
        />
      ))}
    </div>
  );
}

function PactoTab({
  copy,
  copied,
}: {
  copy: (id: string, text: string) => void;
  copied: string | null;
}) {
  const b4 = SEQUENCIA.find((b) => b.id === "b4");
  if (!b4) return null;
  return (
    <div className="space-y-4">
      <Card variant="rose">
        <h3 className="text-sm font-bold text-rose-900 mb-1">
          ⚠️ A lacuna #2 do v1: aceitar "vou pensar" sem pacto
        </h3>
        <p className="text-sm text-rose-800 leading-relaxed">
          Lead some sem pacto = "proposal" eterno. Toda fala de adiamento
          (vou pensar, vou me organizar, vou ver com meu marido) exige
          escala 0-10 + agendar follow_up_at no CRM. Sem isso, status
          "proposal" sem follow_up agendado = ALERTA.
        </p>
      </Card>
      {b4.mensagens.map((m, i) => (
        <MsgCard
          key={i}
          id={`pacto-${i}`}
          titulo={m.titulo}
          texto={m.texto}
          nota={m.nota}
          onCopy={copy}
          copied={copied}
          highlight={m.titulo.includes("CRÍTICA")}
        />
      ))}
    </div>
  );
}

function FechamentoTab({
  copy,
  copied,
}: {
  copy: (id: string, text: string) => void;
  copied: string | null;
}) {
  const b5 = SEQUENCIA.find((b) => b.id === "b5");
  if (!b5) return null;
  return (
    <div className="space-y-4">
      <Card variant="emerald">
        <h3 className="text-sm font-bold text-emerald-900 mb-1">
          ✅ Sequência Michel-style (R$17k fechados em 1h15)
        </h3>
        <p className="text-sm text-emerald-800 leading-relaxed">
          Lead falou "vamos fazer" → executa essa sequência em ≤30min. Foto
          → pasta → apresentação reforçada (vira "Dra. Bárbara" aqui) →
          PIX → confirmação. Não dá tempo do lead duvidar.
        </p>
      </Card>
      {b5.mensagens.map((m, i) => (
        <MsgCard
          key={i}
          id={`fech-${i}`}
          titulo={m.titulo}
          texto={m.texto}
          nota={m.nota}
          onCopy={copy}
          copied={copied}
        />
      ))}
    </div>
  );
}

function FollowupTab({
  copy,
  copied,
}: {
  copy: (id: string, text: string) => void;
  copied: string | null;
}) {
  return (
    <div className="space-y-4">
      <Card variant="rose">
        <p className="text-sm text-rose-900">
          🔁 <strong>5 toques mínimos antes de arquivar como "lost".</strong>{" "}
          Cada toque traz VALOR NOVO (caso, prova, escassez real). Nunca
          "alguma novidade?".
        </p>
      </Card>
      {FOLLOWUP.map((fu, i) => (
        <Card key={i}>
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-base font-semibold text-slate-900">
              <span className="text-rose-600 font-bold">{fu.dia}</span>{" "}
              <span className="text-slate-700">·</span> {fu.titulo}
            </h3>
          </div>
          <MsgCard
            id={`fu-${i}`}
            titulo=""
            texto={fu.texto}
            nota={fu.nota}
            onCopy={copy}
            copied={copied}
            compact
          />
        </Card>
      ))}
    </div>
  );
}

function RegrasTab({
  filterText,
}: {
  filterText: (s: string) => boolean;
}) {
  const filtered = REGRAS.filter(
    (r) => filterText(r.titulo) || filterText(r.descricao),
  );
  const sevColor = {
    critica: "border-red-300 bg-red-50",
    alta: "border-amber-300 bg-amber-50",
    media: "border-slate-200 bg-slate-50",
  };
  const sevLabel = {
    critica: "🔴 crítica",
    alta: "🟡 alta",
    media: "⚪ média",
  };
  return (
    <div className="space-y-3">
      {filtered.map((r, i) => (
        <div
          key={i}
          className={`rounded-xl border-2 p-4 ${sevColor[r.severidade]}`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-sm font-bold text-slate-900">{r.titulo}</h3>
            <span className="text-[10px] font-bold">
              {sevLabel[r.severidade]}
            </span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            {r.descricao}
          </p>
        </div>
      ))}
    </div>
  );
}

function MetricasTab() {
  return (
    <div className="space-y-3">
      <Card variant="rose">
        <p className="text-sm text-rose-900">
          📊 <strong>Métricas pra acompanhar nas próximas 2 semanas.</strong>{" "}
          Revisão sexta 06/06 — Ju + Lucas + Milena.
        </p>
      </Card>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="pb-2 font-semibold">Métrica</th>
              <th className="pb-2 font-semibold">Hoje</th>
              <th className="pb-2 font-semibold">Meta</th>
            </tr>
          </thead>
          <tbody>
            {METRICAS.map((m, i) => (
              <tr
                key={i}
                className="border-b border-slate-100 last:border-0 align-top"
              >
                <td className="py-2 pr-2 font-medium text-slate-800">
                  {m.titulo}
                </td>
                <td className="py-2 pr-2 text-slate-600 text-xs">
                  {m.baseline}
                </td>
                <td className="py-2 text-emerald-700 text-xs font-semibold">
                  {m.meta}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ========== HELPERS ==========

function Card({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant?: "rose" | "emerald";
}) {
  const cls =
    variant === "rose"
      ? "bg-rose-50 border-rose-200"
      : variant === "emerald"
        ? "bg-emerald-50 border-emerald-200"
        : "bg-white border-slate-200";
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>{children}</div>
  );
}

function MsgCard({
  id,
  titulo,
  texto,
  nota,
  onCopy,
  copied,
  highlight,
  compact,
}: {
  id: string;
  titulo: string;
  texto: string;
  nota?: string;
  onCopy: (id: string, text: string) => void;
  copied: string | null;
  highlight?: boolean;
  compact?: boolean;
}) {
  const isCopied = copied === id;
  return (
    <div
      className={`rounded-lg border ${
        highlight
          ? "border-rose-400 bg-rose-50/40"
          : "border-slate-200 bg-slate-50"
      } ${compact ? "" : "p-3"}`}
    >
      {!compact && titulo && (
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-slate-900">{titulo}</p>
          <button
            onClick={() => onCopy(id, texto)}
            className={`text-[10px] font-semibold px-2 py-1 rounded ${
              isCopied
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            }`}
          >
            {isCopied ? "✓ copiado" : "📋 copiar"}
          </button>
        </div>
      )}
      <pre
        className={`text-[13px] text-slate-800 whitespace-pre-wrap font-sans leading-relaxed ${
          compact ? "p-3" : ""
        }`}
      >
        {texto}
      </pre>
      {compact && (
        <div className="px-3 pb-2 flex justify-end">
          <button
            onClick={() => onCopy(id, texto)}
            className={`text-[10px] font-semibold px-2 py-1 rounded ${
              isCopied
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            }`}
          >
            {isCopied ? "✓ copiado" : "📋 copiar"}
          </button>
        </div>
      )}
      {nota && (
        <p className="text-[11px] text-slate-500 italic mt-2 px-1">
          💡 {nota}
        </p>
      )}
    </div>
  );
}

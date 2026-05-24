"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { QuizConfig } from "@/lib/quiz-config";
import type { Question, QuizOption, Archetype, Geo, Variant } from "@/lib/quiz-archetypes";

const VARIANT_TABS: { value: Variant; label: string }[] = [
  { value: "resina", label: "🩷 Plano Resina" },
  { value: "porcelana", label: "🤍 Plano Porcelana" },
];

const ARCH_LABEL: Record<Archetype, string> = {
  PRONTA: "🔥 Pronta",
  ESPERANCOSA: "🟡 Esperançosa",
  CETICA: "📍 Cética",
};

const TONE_OPTIONS: { value: "rose" | "cream" | "cocoa"; label: string }[] = [
  { value: "rose", label: "🌸 Rose" },
  { value: "cream", label: "🤍 Cream" },
  { value: "cocoa", label: "🟫 Cocoa" },
];

export function BuilderView({
  initialConfig,
  variant,
}: {
  initialConfig: QuizConfig;
  variant: Variant;
}) {
  const router = useRouter();
  const [config, setConfig] = useState<QuizConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  function update<K extends keyof QuizConfig>(patch: Pick<QuizConfig, K>) {
    setConfig((c) => ({ ...c, ...patch }));
    setDirty(true);
  }

  function updateQuestion(idx: number, patch: Partial<Question>) {
    setConfig((c) => ({
      ...c,
      questions: c.questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    }));
    setDirty(true);
  }

  function updateOption(qIdx: number, oIdx: number, patch: Partial<QuizOption>) {
    setConfig((c) => ({
      ...c,
      questions: c.questions.map((q, i) =>
        i === qIdx
          ? {
              ...q,
              options: q.options.map((o, j) => (j === oIdx ? { ...o, ...patch } : o)),
            }
          : q,
      ),
    }));
    setDirty(true);
  }

  function addOption(qIdx: number) {
    const newOpt: QuizOption = {
      value: `opt_${Date.now()}`,
      label: "Nova opção",
    };
    setConfig((c) => ({
      ...c,
      questions: c.questions.map((q, i) =>
        i === qIdx ? { ...q, options: [...q.options, newOpt] } : q,
      ),
    }));
    setDirty(true);
  }

  function removeOption(qIdx: number, oIdx: number) {
    setConfig((c) => ({
      ...c,
      questions: c.questions.map((q, i) =>
        i === qIdx
          ? { ...q, options: q.options.filter((_, j) => j !== oIdx) }
          : q,
      ),
    }));
    setDirty(true);
  }

  function updateResult(arch: Archetype, patch: Partial<QuizConfig["results"][Archetype]>) {
    setConfig((c) => ({
      ...c,
      results: { ...c.results, [arch]: { ...c.results[arch], ...patch } },
    }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/quiz/config?variant=${variant}`, {
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
    if (!confirm("Descartar mudanças? Volta pro último salvo.")) return;
    setConfig(initialConfig);
    setDirty(false);
    setError(null);
  }

  function switchVariant(target: Variant) {
    if (target === variant) return;
    if (
      dirty &&
      !confirm(
        "Você tem mudanças não salvas nessa variante. Trocar agora descarta. Continuar?",
      )
    ) {
      return;
    }
    // Navega — page.tsx (force-dynamic) recarrega config da variant nova do DB
    router.push(`/crm/builder?variant=${target}`);
  }

  return (
    <div className="max-w-[1280px] mx-auto px-5 lg:px-8 py-6 w-full">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Construtor do Quiz</h2>
          <p className="text-sm text-slate-500">
            {config.questions.length} perguntas · 3 telas de resultado · live em /quiz/{variant} após salvar
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
          <a
            href={`/quiz/${variant}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-sm rounded-md border border-slate-200 hover:border-slate-400"
          >
            👁 Preview
          </a>
        </div>
      </div>

      {/* Tabs de variant */}
      <div className="flex items-center gap-1 mb-5 border-b border-slate-200">
        {VARIANT_TABS.map((t) => {
          const active = t.value === variant;
          return (
            <button
              key={t.value}
              onClick={() => switchVariant(t.value)}
              className={
                "px-4 py-2 text-sm font-medium -mb-px border-b-2 transition " +
                (active
                  ? "border-rose-500 text-rose-700"
                  : "border-transparent text-slate-500 hover:text-slate-900")
              }
            >
              {t.label}
            </button>
          );
        })}
        <span className="ml-auto text-[11px] text-slate-400">
          Cada variant tem config própria no DB · salvar afeta só /quiz/{variant}
        </span>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* Settings globais */}
      <section className="bg-white border border-slate-200 rounded-md p-4 mb-5">
        <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3">
          Configuração global
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="URL Instagram">
            <input
              value={config.instagram_url}
              onChange={(e) => update({ instagram_url: e.target.value })}
              placeholder="https://www.instagram.com/usuario/"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </Field>
        </div>
      </section>

      {/* Cover (1ª tela) */}
      <CoverEditor
        cover={config.cover}
        onChange={(patch) => {
          setConfig((c) => ({
            ...c,
            cover: { ...(c.cover ?? DEFAULT_COVER), ...patch },
          }));
          setDirty(true);
        }}
      />

      {/* Commitment (2ª tela) */}
      <CommitmentEditor
        commitment={config.commitment}
        onChange={(patch) => {
          setConfig((c) => ({
            ...c,
            commitment: { ...(c.commitment ?? DEFAULT_COMMITMENT), ...patch },
          }));
          setDirty(true);
        }}
      />

      {/* Perguntas */}
      <section className="space-y-3 mb-6">
        <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500">
          Perguntas ({config.questions.length})
        </h3>
        {config.questions.map((q, idx) => (
          <QuestionCard
            key={q.key}
            question={q}
            index={idx}
            onChange={(patch) => updateQuestion(idx, patch)}
            onUpdateOption={(oIdx, patch) => updateOption(idx, oIdx, patch)}
            onAddOption={() => addOption(idx)}
            onRemoveOption={(oIdx) => removeOption(idx, oIdx)}
          />
        ))}
      </section>

      {/* Resultados */}
      <section className="space-y-3 mb-6">
        <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500">
          Telas de resultado (3 arquétipos)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(["PRONTA", "ESPERANCOSA", "CETICA"] as const).map((a) => (
            <ResultCard
              key={a}
              archetype={a}
              copy={config.results[a]}
              onChange={(patch) => updateResult(a, patch)}
            />
          ))}
        </div>
      </section>

      <p className="text-xs text-slate-400 text-center">
        ⚠️ Adicionar/remover perguntas inteiras precisa edit no código (libs/quiz-archetypes.ts).
        Por aqui você edita texto, opções, pesos, geo e knockout.
      </p>
    </div>
  );
}

// =================================================
// QuestionCard
// =================================================

function QuestionCard({
  question,
  index,
  onChange,
  onUpdateOption,
  onAddOption,
  onRemoveOption,
}: {
  question: Question;
  index: number;
  onChange: (patch: Partial<Question>) => void;
  onUpdateOption: (oIdx: number, patch: Partial<QuizOption>) => void;
  onAddOption: () => void;
  onRemoveOption: (oIdx: number) => void;
}) {
  const [open, setOpen] = useState(index < 1);

  return (
    <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono px-2 py-0.5 bg-rose-100 text-rose-800 rounded">
            Q{question.num}
          </span>
          <span className="text-sm font-medium text-slate-900 truncate">
            {question.title}
          </span>
        </div>
        <span className="text-slate-400 text-xs">
          {question.options.length} opções · {open ? "▼" : "▶"}
        </span>
      </button>

      {open && (
        <div className="px-4 py-4 border-t border-slate-100 space-y-3 bg-slate-50/40">
          <Field label="Título">
            <input
              value={question.title}
              onChange={(e) => onChange({ title: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </Field>
          <Field label="Subtítulo (opcional)">
            <input
              value={question.subtitle ?? ""}
              onChange={(e) =>
                onChange({ subtitle: e.target.value || undefined })
              }
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </Field>
          <Field label={`Key (interna) · ${question.key}`}>
            <input
              value={question.key}
              disabled
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-slate-100 text-slate-500 font-mono cursor-not-allowed"
            />
          </Field>

          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-2">
              Opções de resposta ({question.options.length})
            </p>
            <div className="space-y-2">
              {question.options.map((opt, oIdx) => (
                <OptionEditor
                  key={oIdx}
                  option={opt}
                  onChange={(patch) => onUpdateOption(oIdx, patch)}
                  onRemove={() => onRemoveOption(oIdx)}
                  canRemove={question.options.length > 1}
                />
              ))}
            </div>
            <button
              onClick={onAddOption}
              className="mt-3 px-3 py-1.5 text-xs rounded-md border border-dashed border-slate-300 text-slate-600 hover:border-slate-500 hover:text-slate-900"
            >
              + Adicionar opção
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// =================================================
// OptionEditor
// =================================================

function OptionEditor({
  option,
  onChange,
  onRemove,
  canRemove,
}: {
  option: QuizOption;
  onChange: (patch: Partial<QuizOption>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded p-3 space-y-2">
      <div className="grid grid-cols-[60px_1fr_auto] gap-2 items-start">
        <input
          value={option.emoji ?? ""}
          onChange={(e) => onChange({ emoji: e.target.value || undefined })}
          placeholder="🌸"
          maxLength={2}
          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded text-center"
        />
        <input
          value={option.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Label da opção"
          className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded"
        />
        {canRemove && (
          <button
            onClick={onRemove}
            className="text-red-500 text-lg leading-none px-2 hover:text-red-700"
            title="Remover opção"
          >
            ×
          </button>
        )}
      </div>

      {/* Pesos por arquétipo */}
      <div className="grid grid-cols-3 gap-2">
        {(["PRONTA", "ESPERANCOSA", "CETICA"] as const).map((a) => (
          <label key={a} className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              {ARCH_LABEL[a]}
            </span>
            <input
              type="number"
              value={option.weights?.[a] ?? ""}
              onChange={(e) => {
                const num = e.target.value === "" ? undefined : Number(e.target.value);
                const newWeights = { ...(option.weights ?? {}) };
                if (num === undefined || Number.isNaN(num)) {
                  delete newWeights[a];
                } else {
                  newWeights[a] = num;
                }
                onChange({
                  weights:
                    Object.keys(newWeights).length === 0 ? undefined : newWeights,
                });
              }}
              placeholder="0"
              className="w-full px-2 py-1 text-sm border border-slate-200 rounded text-center"
            />
          </label>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            Geo (opcional)
          </span>
          <select
            value={option.geo ?? ""}
            onChange={(e) =>
              onChange({ geo: (e.target.value as Geo) || undefined })
            }
            className="w-full px-2 py-1 text-sm border border-slate-200 rounded"
          >
            <option value="">—</option>
            <option value="SP">SP</option>
            <option value="BR">BR</option>
            <option value="INTL">INTL</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            Case type (Q1)
          </span>
          <input
            value={option.caseType ?? ""}
            onChange={(e) => onChange({ caseType: e.target.value || undefined })}
            placeholder="ex: clareamento+lentes"
            className="w-full px-2 py-1 text-sm border border-slate-200 rounded"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          checked={!!option.knockout}
          onChange={(e) => onChange({ knockout: e.target.checked || undefined })}
          className="accent-slate-900"
        />
        <span>
          Knockout — força <strong>CETICA</strong> (Instagram) independente de score
        </span>
      </label>
    </div>
  );
}

// =================================================
// ResultCard (3 arquétipos)
// =================================================

function ResultCard({
  archetype,
  copy,
  onChange,
}: {
  archetype: Archetype;
  copy: QuizConfig["results"][Archetype];
  onChange: (patch: Partial<QuizConfig["results"][Archetype]>) => void;
}) {
  const accent =
    archetype === "PRONTA"
      ? "bg-green-50 border-green-200"
      : archetype === "ESPERANCOSA"
        ? "bg-amber-50 border-amber-200"
        : "bg-slate-50 border-slate-300";

  return (
    <div className={`rounded-md border p-4 ${accent}`}>
      <p className="text-xs uppercase tracking-wider font-bold mb-3">
        {ARCH_LABEL[archetype]}
      </p>
      <div className="space-y-2">
        <Field label="Badge (texto pequeno acima)">
          <input
            value={copy.badge}
            onChange={(e) => onChange({ badge: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
          />
        </Field>
        <Field label="Título grande">
          <input
            value={copy.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
          />
        </Field>
        <Field label="Descrição">
          <textarea
            value={copy.description}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
          />
        </Field>
        <Field label="Texto do botão (CTA)">
          <input
            value={copy.ctaLabel}
            onChange={(e) => onChange({ ctaLabel: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
          />
        </Field>
        <Field label="Tom visual">
          <select
            value={copy.tone ?? "cream"}
            onChange={(e) =>
              onChange({ tone: e.target.value as "rose" | "cream" | "cocoa" })
            }
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
          >
            {TONE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

// =================================================
// Cover + Commitment editors (telas 1 e 2 do quiz)
// =================================================

const DEFAULT_COVER: NonNullable<QuizConfig["cover"]> = {
  badge: "9 perguntas · 3 minutos",
  headline: "Responde 9 perguntas,",
  headline_highlight: "ganha uma avaliação",
  subtitle1: "Direto e sem rodeio.",
  subtitle2:
    "A equipe da Dra. Juliana lê suas respostas, vê se faz sentido pro nosso protocolo e te chama no WhatsApp pra agendar a avaliação.",
  cta_label: "Começar →",
  legal: "Suas respostas são tratadas com sigilo (LGPD).",
  image_path: undefined,
};

const DEFAULT_COMMITMENT: NonNullable<QuizConfig["commitment"]> = {
  pre_title: "Antes de começar:",
  body: "Quanto mais honesta a resposta, melhor a equipe consegue te receber. Não tem resposta certa nem errada — só direciona o atendimento.",
  question: "Topa responder com sinceridade?",
  yes_label: "Topo, vamos",
  no_label: "Ainda não tenho certeza",
};

function CoverEditor({
  cover,
  onChange,
}: {
  cover: QuizConfig["cover"];
  onChange: (patch: Partial<NonNullable<QuizConfig["cover"]>>) => void;
}) {
  const c = cover ?? DEFAULT_COVER;
  const [open, setOpen] = useState(true);

  return (
    <section className="bg-white border border-slate-200 rounded-md mb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono px-2 py-0.5 bg-rose-100 text-rose-800 rounded">
            Tela 1
          </span>
          <span className="text-sm font-medium text-slate-900">
            Capa (cover) — primeira tela do quiz
          </span>
        </div>
        <span className="text-slate-400 text-xs">{open ? "▼" : "▶"}</span>
      </button>
      {open && (
        <div className="px-4 py-4 border-t border-slate-100 bg-slate-50/40 space-y-3">
          <Field label="Badge (texto pequeno acima do título)">
            <input
              value={c.badge}
              onChange={(e) => onChange({ badge: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Headline (parte normal)">
              <input
                value={c.headline}
                onChange={(e) => onChange({ headline: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
            </Field>
            <Field label="Headline (parte rosa, destaque)">
              <input
                value={c.headline_highlight}
                onChange={(e) =>
                  onChange({ headline_highlight: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
            </Field>
          </div>
          <Field label="Subtítulo 1 (parágrafo principal)">
            <textarea
              value={c.subtitle1}
              onChange={(e) => onChange({ subtitle1: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </Field>
          <Field label="Subtítulo 2 (parágrafo secundário)">
            <textarea
              value={c.subtitle2}
              onChange={(e) => onChange({ subtitle2: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Texto do botão (CTA)">
              <input
                value={c.cta_label}
                onChange={(e) => onChange({ cta_label: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
            </Field>
            <Field label="Texto legal (LGPD, abaixo do botão)">
              <input
                value={c.legal}
                onChange={(e) => onChange({ legal: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
            </Field>
          </div>
          <Field label="Caminho da imagem (em /public, ex: /quiz/case-resina.jpg)">
            <input
              value={c.image_path ?? ""}
              onChange={(e) => onChange({ image_path: e.target.value || undefined })}
              placeholder="/quiz/case-resina.jpg"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md font-mono"
            />
          </Field>
        </div>
      )}
    </section>
  );
}

function CommitmentEditor({
  commitment,
  onChange,
}: {
  commitment: QuizConfig["commitment"];
  onChange: (patch: Partial<NonNullable<QuizConfig["commitment"]>>) => void;
}) {
  const c = commitment ?? DEFAULT_COMMITMENT;
  const [open, setOpen] = useState(false);

  return (
    <section className="bg-white border border-slate-200 rounded-md mb-5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono px-2 py-0.5 bg-rose-100 text-rose-800 rounded">
            Tela 2
          </span>
          <span className="text-sm font-medium text-slate-900">
            Compromisso — pré-pergunta de honestidade
          </span>
        </div>
        <span className="text-slate-400 text-xs">{open ? "▼" : "▶"}</span>
      </button>
      {open && (
        <div className="px-4 py-4 border-t border-slate-100 bg-slate-50/40 space-y-3">
          <Field label="Pré-título">
            <input
              value={c.pre_title}
              onChange={(e) => onChange({ pre_title: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </Field>
          <Field label="Corpo (parágrafo)">
            <textarea
              value={c.body}
              onChange={(e) => onChange({ body: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </Field>
          <Field label="Pergunta de compromisso">
            <input
              value={c.question}
              onChange={(e) => onChange({ question: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Botão 'Sim'">
              <input
                value={c.yes_label}
                onChange={(e) => onChange({ yes_label: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
            </Field>
            <Field label="Botão 'Não'">
              <input
                value={c.no_label}
                onChange={(e) => onChange({ no_label: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
            </Field>
          </div>
        </div>
      )}
    </section>
  );
}

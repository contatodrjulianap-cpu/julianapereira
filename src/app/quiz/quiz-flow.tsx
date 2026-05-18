"use client";

import { useEffect, useMemo, useState } from "react";
import {
  scoreAnswers,
  type AnswerValue,
  type Question,
  type ScoreResult,
} from "@/lib/quiz-archetypes";
import type { QuizConfig } from "@/lib/quiz-config";
import { trackEvent, getUtm } from "@/lib/track";

type Step =
  | { kind: "cover" }
  | { kind: "commitment" }
  | { kind: "question"; index: number }
  | { kind: "selfie" }
  | { kind: "lead" }
  | { kind: "loading" }
  | { kind: "result"; result: ScoreResult; leadId: string };

type Lead = { name: string; phone: string; instagram: string; lgpd: boolean };

function stepNameOf(s: Step): string | null {
  if (s.kind === "cover") return "cover";
  if (s.kind === "commitment") return "commitment";
  if (s.kind === "question") return `q${s.index + 1}`;
  if (s.kind === "selfie") return "selfie";
  if (s.kind === "lead") return "lead";
  if (s.kind === "loading") return "loading";
  if (s.kind === "result") return `result_${s.result.archetype}`;
  return null;
}

export function QuizFlow({ config }: { config: QuizConfig }) {
  const QUESTIONS = config.questions;
  const TOTAL_VISUAL_STEPS = 1 + QUESTIONS.length + 1;

  const [step, setStep] = useState<Step>({ kind: "cover" });
  const [history, setHistory] = useState<Step[]>([{ kind: "cover" }]);

  // Pageview + initial step view (cover) on mount
  useEffect(() => {
    trackEvent("quiz_pageview");
    trackEvent("quiz_step_view", { step: "cover" });
  }, []);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [lead, setLead] = useState<Lead>({
    name: "",
    phone: "",
    instagram: "",
    lgpd: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selfiePath, setSelfiePath] = useState<string | null>(null);

  const progress = useMemo(() => {
    const total = TOTAL_VISUAL_STEPS + 1; // + selfie step
    if (step.kind === "cover") return 0;
    if (step.kind === "commitment") return 1 / total;
    if (step.kind === "question") return (2 + step.index) / total;
    if (step.kind === "selfie") return (2 + QUESTIONS.length) / total;
    if (step.kind === "lead") return (3 + QUESTIONS.length) / total;
    if (step.kind === "loading" || step.kind === "result") return 1;
    return 0;
  }, [step]);

  function go(next: Step) {
    setStep(next);
    setHistory((h) => [...h, next]);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    // Tracking
    const stepName = stepNameOf(next);
    if (stepName) trackEvent("quiz_step_view", { step: stepName });
  }

  function back() {
    if (history.length <= 1) return;
    const newHistory = history.slice(0, -1);
    setHistory(newHistory);
    setStep(newHistory[newHistory.length - 1]);
  }

  function advanceFrom(key: string) {
    const idx = QUESTIONS.findIndex((q) => q.key === key);
    if (idx < QUESTIONS.length - 1) {
      go({ kind: "question", index: idx + 1 });
    } else {
      go({ kind: "selfie" });
    }
  }

  function answerQuestion(key: string, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setTimeout(() => advanceFrom(key), 240);
  }

  function toggleMultiAnswer(key: string, value: string) {
    setAnswers((prev) => {
      const cur = prev[key];
      const arr = Array.isArray(cur) ? cur : cur ? [cur] : [];
      const next = arr.includes(value)
        ? arr.filter((v) => v !== value)
        : [...arr, value];
      return { ...prev, [key]: next };
    });
  }

  async function submitLead() {
    setSubmitError(null);
    setSubmitting(true);
    const phone = lead.phone.replace(/\D/g, "");
    const phoneFmt = phone.startsWith("55") ? phone : `55${phone}`;
    const result = scoreAnswers(answers, QUESTIONS);
    go({ kind: "loading" });

    try {
      const utm = getUtm();
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: lead.name.trim(),
          phone: phoneFmt,
          instagram: lead.instagram.trim() || null,
          archetype: result.archetype,
          geo: result.geo,
          case_type: result.caseType,
          scores: result.scores,
          knockout: result.knockout,
          answers,
          selfie_path: selfiePath,
          utm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");

      // Loading mínimo de 1.8s pra dar a vibe de "calculando"
      await new Promise((r) => setTimeout(r, 1800));
      go({ kind: "result", result, leadId: data.lead_id });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Erro inesperado");
      go({ kind: "lead" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--sakura-cream)", color: "var(--sakura-cocoa)" }}
    >
      <ProgressBar progress={progress} canBack={history.length > 1 && step.kind !== "result"} onBack={back} />

      <main className="flex-1 flex flex-col mx-auto w-full max-w-xl px-5 py-6">
        {step.kind === "cover" && (
          <CoverScreen
            cover={config.cover}
            onStart={() => go({ kind: "commitment" })}
          />
        )}
        {step.kind === "commitment" && (
          <CommitmentScreen
            commitment={config.commitment}
            onYes={() => go({ kind: "question", index: 0 })}
            onNo={() => {
              setAnswers({});
              go({ kind: "result", result: scoreAnswers({}, QUESTIONS), leadId: "" });
            }}
          />
        )}
        {step.kind === "question" && (
          <QuestionScreen
            key={QUESTIONS[step.index].key}
            question={QUESTIONS[step.index]}
            currentAnswer={answers[QUESTIONS[step.index].key]}
            onAnswer={(value) => answerQuestion(QUESTIONS[step.index].key, value)}
            onToggle={(value) => toggleMultiAnswer(QUESTIONS[step.index].key, value)}
            onContinue={() => advanceFrom(QUESTIONS[step.index].key)}
          />
        )}
        {step.kind === "selfie" && (
          <SelfieScreen
            selfiePath={selfiePath}
            onUploaded={(path) => setSelfiePath(path)}
            onContinue={() => go({ kind: "lead" })}
            onSkip={() => {
              setSelfiePath(null);
              go({ kind: "lead" });
            }}
          />
        )}
        {step.kind === "lead" && (
          <LeadScreen
            lead={lead}
            setLead={setLead}
            error={submitError}
            submitting={submitting}
            onSubmit={submitLead}
          />
        )}
        {step.kind === "loading" && <LoadingScreen />}
        {step.kind === "result" && (
          <ResultScreen
            result={step.result}
            firstName={lead.name}
            leadPhone={lead.phone}
            leadId={step.leadId}
            config={config}
          />
        )}
      </main>

      <footer
        className="text-center text-[11px] tracking-[2px] uppercase py-5"
        style={{ color: "var(--sakura-cocoa-3)" }}
      >
        © Dra. Juliana Pereira · CROSP 130.904
      </footer>
    </div>
  );
}

// ============================================================
// Componentes auxiliares
// ============================================================

function ProgressBar({
  progress,
  canBack,
  onBack,
}: {
  progress: number;
  canBack: boolean;
  onBack: () => void;
}) {
  return (
    <div className="px-5 pt-4 pb-2 flex items-center gap-3 max-w-xl mx-auto w-full">
      <button
        aria-label="Voltar"
        onClick={onBack}
        className="w-9 h-9 flex items-center justify-center rounded-full transition hover:opacity-70"
        style={{ visibility: canBack ? "visible" : "hidden" }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M15 6l-6 6 6 6"
            stroke="var(--sakura-cocoa)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        className="flex-1 h-[5px] rounded-full overflow-hidden"
        style={{ background: "var(--sakura-cream-3)" }}
      >
        <div
          className="h-full transition-[width] duration-500"
          style={{
            width: `${progress * 100}%`,
            background: "var(--sakura-cocoa)",
          }}
        />
      </div>
    </div>
  );
}

function CoverScreen({
  cover,
  onStart,
}: {
  cover: QuizConfig["cover"];
  onStart: () => void;
}) {
  const c = cover ?? {
    badge: "Avaliação · 3 min",
    headline: "Responda esse questionário rápido,",
    headline_highlight: "para iniciar a sua avaliação",
    subtitle1:
      "Ao final, preenchendo os requisitos você será direcionado para o WhatsApp, para agendar.",
    cta_label: "Começar →",
    legal: "Suas respostas são tratadas com sigilo (LGPD).",
  };
  return (
    <FadeUp className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col">
        <span
          className="inline-block self-start text-[10px] tracking-[2.5px] uppercase font-semibold px-3 py-1 mb-6"
          style={{
            border: "1px solid var(--sakura-cocoa-3)",
            color: "var(--sakura-cocoa-2)",
          }}
        >
          {c.badge}
        </span>
        <h1
          className="font-[family-name:var(--font-cormorant)] font-light leading-[1.04] mb-4"
          style={{
            fontSize: "clamp(36px, 8vw, 56px)",
            color: "var(--sakura-cocoa)",
          }}
        >
          {c.headline}{" "}
          <em
            className="not-italic font-normal"
            style={{ color: "var(--sakura-rose-2)", fontStyle: "italic" }}
          >
            {c.headline_highlight}
          </em>
          .
        </h1>
        <p
          className={`text-base leading-relaxed ${c.subtitle2 ? "mb-2" : "mb-8"}`}
          style={{ color: "var(--sakura-cocoa-2)" }}
        >
          {c.subtitle1}
        </p>
        {c.subtitle2 && (
          <p
            className="text-sm font-light leading-relaxed mb-8"
            style={{ color: "var(--sakura-cocoa-3)" }}
          >
            {c.subtitle2}
          </p>
        )}
        <div
          className="aspect-[613/732] mb-6 overflow-hidden"
          style={{ border: "1px solid var(--sakura-hairline)" }}
        >
          <img
            src="/quiz/ju-hero.jpg"
            alt="Dra. Juliana Pereira"
            width={613}
            height={732}
            className="w-full h-full object-cover"
          />
        </div>
      </div>
      <PrimaryButton onClick={onStart}>{c.cta_label}</PrimaryButton>
      <p
        className="text-center text-xs mt-3"
        style={{ color: "var(--sakura-cocoa-3)" }}
      >
        {c.legal}
      </p>
    </FadeUp>
  );
}

function CommitmentScreen({
  commitment,
  onYes,
  onNo,
}: {
  commitment: QuizConfig["commitment"];
  onYes: () => void;
  onNo: () => void;
}) {
  const c = commitment ?? {
    pre_title: "Antes de começar:",
    body:
      "Quanto mais honesta a resposta, melhor a equipe consegue te receber. Não tem resposta certa nem errada — só direciona o atendimento.",
    question: "Topa responder com sinceridade?",
    yes_label: "Topo, vamos",
    no_label: "Ainda não tenho certeza",
  };
  return (
    <FadeUp className="flex-1 flex flex-col justify-center">
      <h2
        className="font-[family-name:var(--font-cormorant)] mb-4 leading-[1.1]"
        style={{
          fontSize: "clamp(28px, 6vw, 38px)",
          color: "var(--sakura-cocoa)",
          fontWeight: 500,
        }}
      >
        {c.pre_title}
      </h2>
      <p
        className="text-base leading-relaxed mb-8"
        style={{ color: "var(--sakura-cocoa-2)" }}
      >
        {c.body}
      </p>
      <h3
        className="font-[family-name:var(--font-cormorant)] mb-6"
        style={{ fontSize: "22px", fontWeight: 600 }}
      >
        {c.question}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <OptionButton onClick={onYes}>
          <span className="text-2xl mr-2">🌸</span>
          <span>{c.yes_label}</span>
        </OptionButton>
        <OptionButton onClick={onNo} dim>
          <span className="text-2xl mr-2">🚫</span>
          <span>{c.no_label}</span>
        </OptionButton>
      </div>
    </FadeUp>
  );
}

function QuestionScreen({
  question,
  currentAnswer,
  onAnswer,
  onToggle,
  onContinue,
}: {
  question: Question;
  currentAnswer: AnswerValue | undefined;
  onAnswer: (value: string) => void;
  onToggle: (value: string) => void;
  onContinue: () => void;
}) {
  const isMulti = !!question.multi;
  const selected = Array.isArray(currentAnswer)
    ? currentAnswer
    : currentAnswer
      ? [currentAnswer]
      : [];

  return (
    <FadeUp className="flex-1 flex flex-col justify-center">
      <p
        className="text-[10px] uppercase tracking-[2px] font-semibold font-mono mb-3"
        style={{ color: "var(--sakura-rose-2)" }}
      >
        {String(question.num).padStart(2, "0")} / 08
      </p>
      <h2
        className="font-[family-name:var(--font-cormorant)] leading-[1.15] mb-3"
        style={{
          fontSize: "clamp(24px, 5.4vw, 32px)",
          color: "var(--sakura-cocoa)",
          fontWeight: 500,
        }}
      >
        {question.title}
      </h2>
      {question.subtitle && (
        <p
          className="text-sm italic leading-relaxed mb-7 font-[family-name:var(--font-cormorant)]"
          style={{ color: "var(--sakura-cocoa-3)" }}
        >
          {question.subtitle}
        </p>
      )}
      <div className="flex flex-col gap-3">
        {question.options.map((opt) => {
          const isSelected = selected.includes(opt.value);
          return (
            <OptionButton
              key={opt.value}
              onClick={() =>
                isMulti ? onToggle(opt.value) : onAnswer(opt.value)
              }
              selected={isSelected}
            >
              {opt.emoji && <span className="text-xl mr-1">{opt.emoji}</span>}
              <span className="flex-1">{opt.label}</span>
              {isMulti && (
                <span
                  className="ml-2 w-5 h-5 flex items-center justify-center text-xs"
                  style={{
                    border: `1px solid ${isSelected ? "var(--sakura-rose-2)" : "var(--sakura-hairline)"}`,
                    background: isSelected ? "var(--sakura-rose-2)" : "transparent",
                    color: "var(--sakura-cream)",
                  }}
                >
                  {isSelected ? "✓" : ""}
                </span>
              )}
            </OptionButton>
          );
        })}
      </div>
      {isMulti && (
        <div className="mt-6">
          <PrimaryButton onClick={onContinue} disabled={selected.length === 0}>
            Continuar →
          </PrimaryButton>
        </div>
      )}
    </FadeUp>
  );
}

function LeadScreen({
  lead,
  setLead,
  error,
  submitting,
  onSubmit,
}: {
  lead: Lead;
  setLead: React.Dispatch<React.SetStateAction<Lead>>;
  error: string | null;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const phoneDigits = lead.phone.replace(/\D/g, "");
  const valid =
    lead.name.trim().length >= 2 && phoneDigits.length >= 10 && lead.lgpd;

  return (
    <FadeUp className="flex-1 flex flex-col justify-center">
      <p
        className="text-[10px] uppercase tracking-[2px] font-semibold font-mono mb-3"
        style={{ color: "var(--sakura-rose-2)" }}
      >
        Quase lá
      </p>
      <h2
        className="font-[family-name:var(--font-cormorant)] leading-[1.15] mb-3"
        style={{
          fontSize: "clamp(26px, 5.4vw, 34px)",
          color: "var(--sakura-cocoa)",
          fontWeight: 500,
        }}
      >
        Onde a equipe te chama?
      </h2>
      <p
        className="text-sm italic leading-relaxed mb-7 font-[family-name:var(--font-cormorant)]"
        style={{ color: "var(--sakura-cocoa-3)" }}
      >
        Avaliação sem compromisso. A equipe responde no WhatsApp em horário comercial.
      </p>

      <div className="flex flex-col gap-4 mb-5">
        <Field
          label="Seu primeiro nome"
          value={lead.name}
          onChange={(v) => setLead((l) => ({ ...l, name: v }))}
          placeholder="Maria"
          autoComplete="given-name"
        />
        <Field
          label="WhatsApp (com DDD, só números)"
          value={lead.phone}
          onChange={(v) => setLead((l) => ({ ...l, phone: v }))}
          placeholder="11999999999"
          inputMode="numeric"
          autoComplete="tel"
        />
        <Field
          label="Instagram (opcional)"
          value={lead.instagram}
          onChange={(v) => setLead((l) => ({ ...l, instagram: v }))}
          placeholder="@seuusuario"
          autoComplete="off"
        />
      </div>

      <label className="flex items-start gap-3 mb-4 cursor-pointer text-sm">
        <input
          type="checkbox"
          checked={lead.lgpd}
          onChange={(e) => setLead((l) => ({ ...l, lgpd: e.target.checked }))}
          className="mt-[3px] w-4 h-4 accent-[var(--sakura-cocoa)]"
        />
        <span style={{ color: "var(--sakura-cocoa-2)" }}>
          Aceito receber contato sobre meu plano. Minhas respostas e a foto
          enviada são tratadas com sigilo (LGPD) e usadas apenas pra avaliação
          clínica e orçamento pela Dra. Juliana.
        </span>
      </label>

      {error && (
        <p
          className="text-sm mb-3"
          style={{ color: "var(--sakura-rose-2)" }}
        >
          {error}
        </p>
      )}

      <PrimaryButton onClick={onSubmit} disabled={!valid || submitting}>
        {submitting ? "Enviando..." : "Ver meu diagnóstico →"}
      </PrimaryButton>
    </FadeUp>
  );
}

function SelfieScreen({
  selfiePath,
  onUploaded,
  onContinue,
  onSkip,
}: {
  selfiePath: string | null;
  onUploaded: (path: string) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/quiz/upload-selfie", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar");
      onUploaded(data.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <FadeUp className="flex-1 flex flex-col justify-center">
      <p
        className="text-[10px] uppercase tracking-[2px] font-semibold font-mono mb-3"
        style={{ color: "var(--sakura-rose-2)" }}
      >
        Foto opcional
      </p>
      <h2
        className="font-[family-name:var(--font-cormorant)] leading-[1.15] mb-3"
        style={{
          fontSize: "clamp(26px, 5.4vw, 34px)",
          color: "var(--sakura-cocoa)",
          fontWeight: 500,
        }}
      >
        Quer mandar uma foto do seu sorriso?
      </h2>
      <p
        className="text-sm italic leading-relaxed mb-7 font-[family-name:var(--font-cormorant)]"
        style={{ color: "var(--sakura-cocoa-3)" }}
      >
        A Dra. Juliana usa pra preparar sua avaliação e o orçamento antes do
        atendimento. Você pode pular essa etapa.
      </p>

      {preview && (
        <div
          className="aspect-square mb-5 overflow-hidden"
          style={{ border: "1px solid var(--sakura-hairline)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Pré-visualização do sorriso"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <label
        className="block text-center font-semibold py-4 px-6 cursor-pointer transition active:scale-[0.98] mb-3"
        style={{
          background: "var(--sakura-cream-2)",
          border: "1px solid var(--sakura-hairline)",
          color: "var(--sakura-cocoa)",
          fontSize: "15px",
          letterSpacing: "0.5px",
          opacity: uploading ? 0.6 : 1,
          pointerEvents: uploading ? "none" : "auto",
        }}
      >
        {uploading
          ? "Enviando..."
          : preview
            ? "📸 Trocar foto"
            : "📸 Tirar / escolher foto"}
        <input
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
      </label>

      {error && (
        <p className="text-sm mb-3" style={{ color: "var(--sakura-rose-2)" }}>
          {error}
        </p>
      )}

      <PrimaryButton onClick={onContinue} disabled={uploading || !selfiePath}>
        Continuar →
      </PrimaryButton>
      <button
        onClick={onSkip}
        className="mt-3 text-sm underline transition hover:opacity-70"
        style={{ color: "var(--sakura-cocoa-3)" }}
      >
        Pular essa etapa
      </button>
    </FadeUp>
  );
}

function LoadingScreen() {
  return (
    <FadeUp className="flex-1 flex flex-col justify-center">
      <p
        className="text-[10px] uppercase tracking-[2px] font-semibold font-mono mb-3"
        style={{ color: "var(--sakura-rose-2)" }}
      >
        Organizando pra equipe
      </p>
      <h2
        className="font-[family-name:var(--font-cormorant)] leading-[1.15] mb-8"
        style={{
          fontSize: "clamp(26px, 5.4vw, 36px)",
          color: "var(--sakura-cocoa)",
          fontWeight: 500,
        }}
      >
        Direcionando suas respostas pro time certo.
      </h2>
      <div className="flex flex-col gap-3">
        <LoadingPill delay={0}>Lendo o que você respondeu</LoadingPill>
        <LoadingPill delay={0.4}>Encaixando no protocolo da clínica</LoadingPill>
        <LoadingPill delay={0.8}>Liberando o WhatsApp da equipe</LoadingPill>
      </div>
    </FadeUp>
  );
}

function ResultScreen({
  result,
  firstName,
  leadPhone,
  leadId,
  config,
}: {
  result: ScoreResult;
  firstName: string;
  leadPhone: string;
  leadId: string;
  config: QuizConfig;
}) {
  const copy = config.results[result.archetype];
  const tone = copy.tone ?? "cream";
  const nome = firstName.trim().split(" ")[0] || "você";

  const toneStyles: Record<"rose" | "cream" | "cocoa", { bg: string; fg: string }> = {
    rose: { bg: "var(--sakura-rose-2)", fg: "var(--sakura-cream)" },
    cream: { bg: "var(--sakura-cream-2)", fg: "var(--sakura-cocoa)" },
    cocoa: { bg: "var(--sakura-cocoa)", fg: "var(--sakura-cream)" },
  };

  const t = toneStyles[tone];

  // CTA resolvido server-side: round-robin sticky entre as atendentes via
  // /api/quiz/wa-link. Pre-fetch no mount pra deixar o link pronto antes
  // do usuário clicar (sem perda de UX). CETICA sempre vai pro Instagram.
  const [ctaHref, setCtaHref] = useState<string>(
    result.archetype === "CETICA" ? config.instagram_url : "",
  );
  const [ctaLoading, setCtaLoading] = useState<boolean>(result.archetype !== "CETICA");

  useEffect(() => {
    if (result.archetype === "CETICA") return;
    let alive = true;
    const params = new URLSearchParams({
      archetype: result.archetype,
      phone: leadPhone,
      fn: firstName,
    });
    fetch(`/api/quiz/wa-link?${params.toString()}`)
      .then((r) => r.json())
      .then((j: { url?: string }) => {
        if (!alive) return;
        setCtaHref(j.url ?? "");
        setCtaLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setCtaLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [result.archetype, leadPhone, firstName]);

  return (
    <FadeUp className="flex-1 flex flex-col">
      <div
        className="text-center text-[11px] tracking-[2px] uppercase font-semibold py-3 px-4 mb-6"
        style={{ background: t.bg, color: t.fg }}
      >
        {copy.badge}
      </div>

      <h2
        className="font-[family-name:var(--font-cormorant)] leading-[1.1] mb-5"
        style={{
          fontSize: "clamp(30px, 7vw, 46px)",
          color: "var(--sakura-cocoa)",
          fontWeight: 500,
        }}
      >
        {nome.charAt(0).toUpperCase() + nome.slice(1)}, {copy.title.toLowerCase()}
      </h2>

      <p
        className="text-base leading-relaxed mb-8"
        style={{ color: "var(--sakura-cocoa-2)" }}
      >
        {copy.description}
      </p>

      <a
        href={ctaHref || "#"}
        aria-disabled={ctaLoading || !ctaHref}
        target={result.archetype === "CETICA" ? "_blank" : "_self"}
        rel="noopener noreferrer"
        onClick={(e) => {
          if (ctaLoading || !ctaHref) {
            e.preventDefault();
            return;
          }
          trackEvent(
            result.archetype === "CETICA" ? "quiz_instagram_click" : "quiz_wa_click",
            { archetype: result.archetype, geo: result.geo, lead_id: leadId },
          );
        }}
        className="block text-center font-semibold py-4 px-6 rounded-none mb-3 transition hover:opacity-90"
        style={{
          background:
            result.archetype === "CETICA"
              ? "var(--sakura-cocoa)"
              : "var(--sakura-rose-2)",
          color: "var(--sakura-cream)",
          fontSize: "16px",
          letterSpacing: "0.5px",
          opacity: ctaLoading ? 0.6 : 1,
          cursor: ctaLoading ? "wait" : "pointer",
        }}
      >
        {ctaLoading ? "Preparando…" : copy.ctaLabel}
      </a>

      <p
        className="text-center text-xs mt-3"
        style={{ color: "var(--sakura-cocoa-3)" }}
      >
        Dra. Juliana Pereira · CROSP 130.904 · Resultados variam conforme avaliação
        clínica.
      </p>
    </FadeUp>
  );
}

// ============================================================
// Primitivos
// ============================================================

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-4 px-6 font-semibold text-base transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: "var(--sakura-cocoa)",
        color: "var(--sakura-cream)",
        letterSpacing: "0.5px",
      }}
    >
      {children}
    </button>
  );
}

function OptionButton({
  children,
  onClick,
  dim,
  selected,
}: {
  children: React.ReactNode;
  onClick: () => void;
  dim?: boolean;
  selected?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left py-4 px-5 transition flex items-center gap-3 hover:opacity-95 active:scale-[0.99]"
      style={{
        background: selected ? "var(--sakura-cream-3)" : "var(--sakura-cream-2)",
        border: `1px solid ${selected ? "var(--sakura-rose-2)" : "var(--sakura-hairline)"}`,
        color: dim ? "var(--sakura-cocoa-3)" : "var(--sakura-cocoa)",
        fontSize: "15px",
        fontWeight: 500,
      }}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "numeric" | "text";
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span
        className="text-[10px] tracking-[2px] uppercase font-semibold"
        style={{ color: "var(--sakura-cocoa-3)" }}
      >
        {label}
      </span>
      <input
        type="text"
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-4 py-3 text-base outline-none transition focus:border-[var(--sakura-cocoa)]"
        style={{
          background: "var(--sakura-cream)",
          border: "1px solid var(--sakura-hairline)",
          color: "var(--sakura-cocoa)",
        }}
      />
    </label>
  );
}

function FadeUp({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        animation: "sakuraFadeUp 0.4s ease both",
      }}
    >
      {children}
      <style jsx>{`
        @keyframes sakuraFadeUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function LoadingPill({
  children,
  delay,
}: {
  children: React.ReactNode;
  delay: number;
}) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), (delay + 0.6) * 1000);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      className="relative py-4 px-5 text-sm font-medium overflow-hidden"
      style={{
        background: done ? "var(--sakura-rose-2)" : "var(--sakura-cream-2)",
        color: done ? "var(--sakura-cream)" : "var(--sakura-cocoa-3)",
        border: "1px solid var(--sakura-hairline)",
        transition: "all 0.5s",
      }}
    >
      {children}
    </div>
  );
}

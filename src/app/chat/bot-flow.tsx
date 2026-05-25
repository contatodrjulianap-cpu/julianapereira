"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  scoreAnswers,
  shouldSkipQuestion,
  RESULT_COPY,
  INSTAGRAM_URL,
  VARIANT_LABEL,
  whatsappMessageFor,
  type AnswerValue,
  type Archetype,
  type Question,
  type QuizOption,
  type ScoreResult,
  type Variant,
} from "@/lib/quiz-archetypes";
import type { QuizConfig } from "@/lib/quiz-config";
import { trackEvent, getUtm } from "@/lib/track";
import { normalizePhone } from "@/lib/phone";

// =============================================================
// Tipos
// =============================================================

type Msg =
  | { id: string; kind: "bot" | "user"; text: string }
  | { id: string; kind: "user_image"; src: string };

type Phase =
  | { kind: "intro_pending" } // bot ainda digitando saudação
  | { kind: "intro_ready" } // botão "Vamos lá"
  | { kind: "question"; idx: number; ready: boolean } // ready = bot terminou de mandar a pergunta
  | { kind: "ask_name"; ready: boolean }
  | { kind: "ask_phone"; ready: boolean; nameJustGiven: string }
  | { kind: "ask_image"; ready: boolean }
  | { kind: "submitting" }
  | { kind: "result"; result: ScoreResult; leadId: string; waUrl: string | null }
  | { kind: "error"; message: string };

// =============================================================
// Constantes visuais (paleta WhatsApp dark)
// =============================================================

const C = {
  bg: "#0B141A",
  header: "#202C33",
  panel: "#202C33",
  bubbleBot: "#202C33",
  bubbleUser: "#005C4B",
  text: "#E9EDEF",
  textDim: "#8696A0",
  accent: "#00A884",
  inputBg: "#2A3942",
  divider: "#1F2C33",
  hover: "#2A3942",
} as const;

// Delay de "digitação" proporcional ao tamanho do texto
function typingMs(text: string) {
  return Math.min(2400, Math.max(700, text.length * 22));
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function firstNameOf(full: string) {
  return full.trim().split(/\s+/)[0] ?? full;
}

// =============================================================
// Component
// =============================================================

export function BotFlow({
  config,
  variant,
}: {
  config: QuizConfig;
  variant: Variant;
}) {
  const QUESTIONS = config.questions;

  // Primeira mensagem já no estado inicial — aparece instantânea no primeiro
  // render, antes do efeito de typing das próximas. Reduz tela vazia e
  // melhora conversão (lead vê algo no instante zero).
  const [messages, setMessages] = useState<Msg[]>(() => [
    {
      id: "init",
      kind: "bot",
      text: "Oi! Aqui é a equipe da Dra. Juliana Pereira 🌸",
    },
  ]);
  const [typing, setTyping] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "intro_pending" });
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [multiPick, setMultiPick] = useState<string[]>([]); // buffer Q1 multi
  const [textInput, setTextInput] = useState("");
  const [lead, setLead] = useState({ name: "", phone: "" });
  const [selfiePath, setSelfiePath] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const [inputAreaH, setInputAreaH] = useState(0);

  // ResizeObserver no InputArea: quando os chips/inputs entram/saem, ele muda
  // de altura. Refletimos isso como paddingBottom no scroller pra que a última
  // mensagem nunca fique atrás do painel — e re-scrollamos.
  useEffect(() => {
    const el = inputAreaRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect?.height ?? 0;
      setInputAreaH(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Auto-scroll a cada mudança em messages/typing/phase OU quando o painel
  // de input muda de tamanho (chip aparece, etc).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing, phase, inputAreaH]);

  // -----------------------------------------------------------
  // Helpers de fala do bot
  // -----------------------------------------------------------

  const pushBot = useCallback(async (text: string) => {
    setTyping(true);
    await new Promise((r) => setTimeout(r, typingMs(text)));
    setMessages((m) => [...m, { id: uid(), kind: "bot", text }]);
    setTyping(false);
    // micro-pausa entre mensagens
    await new Promise((r) => setTimeout(r, 240));
  }, []);

  const pushUser = useCallback((text: string) => {
    setMessages((m) => [...m, { id: uid(), kind: "user", text }]);
  }, []);

  // -----------------------------------------------------------
  // Sequências de mensagens por fase
  // -----------------------------------------------------------

  const sayIntro = useCallback(async () => {
    const mat = VARIANT_LABEL[variant];
    // 1ª msg já vem no estado inicial — pulamos aqui e começamos da 2ª
    // com efeito de digitação normal.
    await pushBot(
      `Vou te fazer 9 perguntas rápidas pra entender se você é caso pro plano de *${mat}*.`,
    );
    await pushBot(
      "Quanto mais honesta a resposta, melhor a equipe consegue te receber. Não tem certo nem errado.",
    );
    await pushBot("Topa? 💬");
    setPhase({ kind: "intro_ready" });
  }, [pushBot, variant]);

  const sayQuestion = useCallback(
    async (idx: number) => {
      const q = QUESTIONS[idx];
      await pushBot(q.title);
      if (q.subtitle) await pushBot(q.subtitle);
      setPhase({ kind: "question", idx, ready: true });
    },
    [QUESTIONS, pushBot],
  );

  const askName = useCallback(async () => {
    await pushBot("Pra fechar, só preciso de mais 2 informações.");
    await pushBot("Como posso te chamar?");
    setPhase({ kind: "ask_name", ready: true });
  }, [pushBot]);

  const askPhone = useCallback(
    async (name: string) => {
      const fn = firstNameOf(name);
      await pushBot(`Prazer, ${fn}! 💚`);
      await pushBot(
        "E qual seu *WhatsApp* (com DDD)? É por aqui que a equipe vai te chamar.",
      );
      setPhase({ kind: "ask_phone", ready: true, nameJustGiven: name });
    },
    [pushBot],
  );

  const askImage = useCallback(async () => {
    await pushBot("Show, terminou as perguntas 🙌");
    await pushBot(
      "Antes de trocar os dados, pode me mandar uma *foto do seu sorriso atual*? 📸",
    );
    await pushBot(
      "A Ju usa pra preparar sua avaliação antes do atendimento. É opcional, pode pular.",
    );
    setPhase({ kind: "ask_image", ready: true });
  }, [pushBot]);


  // -----------------------------------------------------------
  // Tracking
  // -----------------------------------------------------------

  useEffect(() => {
    trackEvent("quiz_pageview", { variant, surface: "bot" });
    trackEvent("quiz_step_view", { step: "cover", variant, surface: "bot" });
  }, [variant]);

  // -----------------------------------------------------------
  // Inicialização — só roda uma vez
  // -----------------------------------------------------------

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    sayIntro();
  }, [sayIntro]);

  // -----------------------------------------------------------
  // Handlers de interação
  // -----------------------------------------------------------

  function startQuiz() {
    pushUser("✅ Topo, vamos");
    trackEvent("quiz_step_view", { step: "commitment", variant, surface: "bot" });
    setPhase({ kind: "question", idx: 0, ready: false });
    sayQuestion(0);
  }

  function advanceFromQuestion(
    idx: number,
    snapshot: Record<string, AnswerValue> = answers,
  ) {
    // Usa question.num pra manter o funil estável com perguntas condicionais
    // (q6_geo_cidade compartilha num=7 com q6_geo).
    trackEvent("quiz_step_view", {
      step: `q${QUESTIONS[idx]?.num ?? idx + 1}`,
      variant,
      surface: "bot",
    });
    let nextIdx = idx + 1;
    while (
      nextIdx < QUESTIONS.length &&
      shouldSkipQuestion(QUESTIONS[nextIdx], snapshot)
    ) {
      nextIdx++;
    }
    if (nextIdx < QUESTIONS.length) {
      setPhase({ kind: "question", idx: nextIdx, ready: false });
      sayQuestion(nextIdx);
    } else {
      trackEvent("quiz_step_view", { step: "selfie", variant, surface: "bot" });
      setPhase({ kind: "ask_image", ready: false });
      askImage();
    }
  }

  function pickOption(idx: number, q: Question, opt: QuizOption) {
    pushUser(opt.label);
    const next = { ...answers, [q.key]: opt.value };
    setAnswers(next);
    setTimeout(() => advanceFromQuestion(idx, next), 320);
  }

  function pickMulti(value: string) {
    setMultiPick((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  function submitMulti(idx: number, q: Question) {
    if (multiPick.length === 0) return;
    const labels = multiPick
      .map((v) => q.options.find((o) => o.value === v)?.label)
      .filter(Boolean)
      .join(" · ");
    pushUser(labels);
    const next = { ...answers, [q.key]: multiPick };
    setAnswers(next);
    setMultiPick([]);
    setTimeout(() => advanceFromQuestion(idx, next), 320);
  }

  function submitTextAnswer(idx: number, q: Question) {
    const value = textInput.trim();
    if (value.length < 2) return;
    pushUser(value);
    const next = { ...answers, [q.key]: value };
    setAnswers(next);
    setTextInput("");
    setTimeout(() => advanceFromQuestion(idx, next), 320);
  }

  function submitName() {
    const value = textInput.trim();
    if (value.length < 2) return;
    pushUser(value);
    setLead((l) => ({ ...l, name: value }));
    setTextInput("");
    setPhase({ kind: "ask_phone", ready: false, nameJustGiven: value });
    askPhone(value);
  }

  function submitPhone() {
    const normalized = normalizePhone(textInput);
    if (normalized.length < 10) return;
    pushUser(textInput.trim());
    setLead((l) => ({ ...l, phone: normalized }));
    setTextInput("");
    doSubmit(lead.name, normalized, selfiePath);
  }

  async function handleImageFile(file: File) {
    setImageError(null);
    setUploadingImage(true);
    const localPreview = URL.createObjectURL(file);
    // Mostra a foto no chat enquanto sobe (otimismo visual)
    setMessages((m) => [
      ...m,
      { id: uid(), kind: "user_image", src: localPreview },
    ]);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/quiz/upload-selfie", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar");
      setSelfiePath(data.path);
      await pushBot("Recebi a foto, valeu! 🙏");
      setPhase({ kind: "ask_name", ready: false });
      askName();
    } catch (e) {
      setImageError(e instanceof Error ? e.message : "Erro ao enviar foto");
    } finally {
      setUploadingImage(false);
    }
  }

  function skipImage() {
    pushUser("Pular");
    setSelfiePath(null);
    setPhase({ kind: "ask_name", ready: false });
    askName();
  }

  async function doSubmit(name: string, phone: string, selfie: string | null) {
    setPhase({ kind: "submitting" });
    await pushBot("Calculando seu perfil…");

    try {
      const utm = getUtm();
      const result = scoreAnswers(answers, QUESTIONS);
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          instagram: null,
          archetype: result.archetype,
          geo: result.geo,
          case_type: result.caseType,
          scores: result.scores,
          knockout: result.knockout,
          answers,
          selfie_path: selfie,
          variant,
          surface: "bot",
          utm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");

      // Pega a URL de destino (wa.me da atendente ou Instagram se CETICA)
      const fn = firstNameOf(name);
      const linkRes = await fetch(
        `/api/quiz/wa-link?archetype=${result.archetype}&phone=${phone}&fn=${encodeURIComponent(fn)}&variant=${variant}`,
      );
      const linkData = await linkRes.json();
      const waUrl: string | null = linkData?.url ?? null;

      await new Promise((r) => setTimeout(r, 1200));

      const copy = RESULT_COPY[result.archetype];
      await pushBot(`*${copy.badge}*`);
      await pushBot(copy.title);
      await pushBot(BOT_RESULT_DESCRIPTION[result.archetype]);

      setPhase({
        kind: "result",
        result,
        leadId: data.lead_id,
        waUrl,
      });
      trackEvent("quiz_step_view", {
        step: `result_${result.archetype}`,
        variant,
        surface: "bot",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro inesperado";
      setPhase({ kind: "error", message: msg });
    }
  }

  function clickResultCta() {
    if (phase.kind !== "result") return;
    const arch = phase.result.archetype;
    if (arch === "CETICA") {
      trackEvent("quiz_instagram_click", { variant, surface: "bot" });
    } else {
      trackEvent("quiz_wa_click", { variant, surface: "bot" });
    }
    const url = phase.waUrl ?? (arch === "CETICA" ? INSTAGRAM_URL : "");
    if (url) window.location.href = url;
  }

  // -----------------------------------------------------------
  // Render
  // -----------------------------------------------------------

  const currentQuestion =
    phase.kind === "question" ? QUESTIONS[phase.idx] : null;
  const isMulti = !!currentQuestion?.multi;
  const isText = currentQuestion?.inputType === "text";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
        background: C.bg,
        color: C.text,
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      <Header variant={variant} typing={typing} />

      <div
        ref={scrollerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 12px 24px",
          backgroundImage: WHATSAPP_PATTERN,
          backgroundSize: "412px",
          backgroundRepeat: "repeat",
          backgroundColor: C.bg,
        }}
      >
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          {messages.map((m) =>
            m.kind === "user_image" ? (
              <ImageBubble key={m.id} src={m.src} />
            ) : (
              <Bubble key={m.id} kind={m.kind} text={m.text} />
            ),
          )}
          {typing && <TypingDots />}
          {phase.kind === "result" && (
            <ResultCard
              archetype={phase.result.archetype}
              firstName={firstNameOf(lead.name)}
              variant={variant}
              onClick={clickResultCta}
            />
          )}
          {phase.kind === "error" && (
            <div
              style={{
                color: "#f7a7a7",
                fontSize: 13,
                padding: 12,
                background: "#3c1e1e",
                borderRadius: 8,
                margin: "8px 0",
              }}
            >
              {phase.message}. Recarregue a página pra tentar de novo.
            </div>
          )}
          <div style={{ height: 12 }} />
        </div>
      </div>

      <InputArea innerRef={inputAreaRef}>
        {phase.kind === "intro_ready" && (
          <PrimaryButton onClick={startQuiz}>✅ Topo, vamos</PrimaryButton>
        )}

        {phase.kind === "question" &&
          phase.ready &&
          currentQuestion &&
          !isText &&
          !isMulti && (
            <ChipList>
              {currentQuestion.options.map((opt) => (
                <Chip
                  key={opt.value}
                  onClick={() => pickOption(phase.idx, currentQuestion, opt)}
                >
                  {opt.emoji ? `${opt.emoji} ` : ""}
                  {opt.label}
                </Chip>
              ))}
            </ChipList>
          )}

        {phase.kind === "question" &&
          phase.ready &&
          currentQuestion &&
          isMulti && (
            <>
              <ChipList>
                {currentQuestion.options.map((opt) => (
                  <Chip
                    key={opt.value}
                    selected={multiPick.includes(opt.value)}
                    onClick={() => pickMulti(opt.value)}
                  >
                    {opt.emoji ? `${opt.emoji} ` : ""}
                    {opt.label}
                  </Chip>
                ))}
              </ChipList>
              <PrimaryButton
                onClick={() => submitMulti(phase.idx, currentQuestion)}
                disabled={multiPick.length === 0}
              >
                Continuar →
              </PrimaryButton>
            </>
          )}

        {phase.kind === "question" &&
          phase.ready &&
          currentQuestion &&
          isText && (
            <TextRow>
              <BotInput
                value={textInput}
                onChange={setTextInput}
                placeholder={currentQuestion.textPlaceholder ?? "Sua resposta…"}
                onSubmit={() => submitTextAnswer(phase.idx, currentQuestion)}
              />
              <SendButton
                disabled={textInput.trim().length < 2}
                onClick={() => submitTextAnswer(phase.idx, currentQuestion)}
              />
            </TextRow>
          )}

        {phase.kind === "ask_name" && phase.ready && (
          <TextRow>
            <BotInput
              value={textInput}
              onChange={setTextInput}
              placeholder="Seu nome"
              onSubmit={submitName}
              autoFocus
            />
            <SendButton
              disabled={textInput.trim().length < 2}
              onClick={submitName}
            />
          </TextRow>
        )}

        {phase.kind === "ask_phone" && phase.ready && (
          <TextRow>
            <BotInput
              value={textInput}
              onChange={setTextInput}
              placeholder="11 9 9999 9999"
              onSubmit={submitPhone}
              inputMode="tel"
              autoFocus
            />
            <SendButton
              disabled={normalizePhone(textInput).length < 10}
              onClick={submitPhone}
            />
          </TextRow>
        )}

        {phase.kind === "ask_image" && phase.ready && (
          <ImagePicker
            uploading={uploadingImage}
            error={imageError}
            onFile={handleImageFile}
            onSkip={skipImage}
          />
        )}

      </InputArea>
    </div>
  );
}

// =============================================================
// Subcomponentes visuais
// =============================================================

function Header({ variant, typing }: { variant: Variant; typing: boolean }) {
  const status = typing ? "digitando…" : "online · responde em minutos";
  const plano = variant === "porcelana" ? "Porcelana" : "Resina";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        background: C.header,
        borderBottom: `1px solid ${C.divider}`,
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "#3A2A20",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/quiz/ju-hero.jpg"
          alt="Dra. Juliana Pereira"
          width={40}
          height={40}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 500, color: C.text }}>
          Dra. Juliana Pereira
        </div>
        <div style={{ fontSize: 12, color: C.textDim }}>
          {status} · Plano {plano}
        </div>
      </div>
    </div>
  );
}

function Bubble({ kind, text }: { kind: "bot" | "user"; text: string }) {
  const isBot = kind === "bot";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isBot ? "flex-start" : "flex-end",
        margin: "6px 0",
      }}
    >
      <div
        style={{
          maxWidth: "78%",
          background: isBot ? C.bubbleBot : C.bubbleUser,
          color: C.text,
          padding: "8px 12px 10px",
          borderRadius: isBot ? "10px 10px 10px 2px" : "10px 10px 2px 10px",
          boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)",
          fontSize: 15,
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
        dangerouslySetInnerHTML={{ __html: renderText(text) }}
      />
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", margin: "6px 0" }}>
      <div
        style={{
          background: C.bubbleBot,
          padding: "10px 14px",
          borderRadius: "10px 10px 10px 2px",
          display: "flex",
          gap: 4,
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: C.textDim,
              animation: `chat-dot 1.2s ${i * 0.15}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes chat-dot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>
    </div>
  );
}

function InputArea({
  children,
  innerRef,
}: {
  children: React.ReactNode;
  innerRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={innerRef}
      style={{
        background: C.header,
        borderTop: `1px solid ${C.divider}`,
        padding: "12px",
        paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
        flexShrink: 0,
        maxHeight: "60dvh",
        overflowY: "auto",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

function ChipList({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function Chip({
  children,
  onClick,
  selected,
}: {
  children: React.ReactNode;
  onClick: () => void;
  selected?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        background: selected ? C.accent : C.inputBg,
        color: selected ? "#0B141A" : C.text,
        border: `1px solid ${selected ? C.accent : "transparent"}`,
        borderRadius: 12,
        padding: "12px 14px",
        fontSize: 14.5,
        cursor: "pointer",
        transition: "background 120ms, color 120ms",
        fontFamily: "inherit",
        lineHeight: 1.35,
      }}
    >
      {children}
    </button>
  );
}

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
      style={{
        width: "100%",
        background: disabled ? "#1F3A33" : C.accent,
        color: disabled ? C.textDim : "#0B141A",
        border: "none",
        borderRadius: 12,
        padding: "14px 16px",
        fontSize: 16,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        marginTop: 4,
        fontFamily: "inherit",
        transition: "background 120ms",
      }}
    >
      {children}
    </button>
  );
}

function TextRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {children}
    </div>
  );
}

function BotInput({
  value,
  onChange,
  placeholder,
  onSubmit,
  inputMode,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onSubmit: () => void;
  inputMode?: "tel" | "text";
  autoFocus?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode ?? "text"}
      autoFocus={autoFocus}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onSubmit();
        }
      }}
      style={{
        flex: 1,
        background: C.inputBg,
        color: C.text,
        border: "none",
        borderRadius: 22,
        padding: "12px 16px",
        fontSize: 16,
        outline: "none",
        fontFamily: "inherit",
      }}
    />
  );
}

function SendButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label="Enviar"
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: disabled ? C.inputBg : C.accent,
        color: disabled ? C.textDim : "#0B141A",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        transition: "background 120ms",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
      </svg>
    </button>
  );
}

function ResultCard({
  archetype,
  firstName,
  variant,
  onClick,
}: {
  archetype: Archetype;
  firstName: string;
  variant: Variant;
  onClick: () => void;
}) {
  // CETICA vai pro Instagram — sem preview de mensagem
  const showPreview = archetype !== "CETICA";
  const previewMsg = showPreview
    ? whatsappMessageFor(archetype, firstName, variant)
    : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        margin: "12px 0",
      }}
    >
      {previewMsg && (
        <>
          <div
            style={{
              fontSize: 11,
              color: C.textDim,
              textAlign: "center",
              letterSpacing: "0.5px",
              marginBottom: 2,
            }}
          >
            ↓ MENSAGEM JÁ PRONTA — É SÓ TOCAR EM ENVIAR ↓
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div
              style={{
                maxWidth: "85%",
                background: C.bubbleUser,
                color: C.text,
                padding: "8px 12px 10px",
                borderRadius: "10px 10px 2px 10px",
                boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)",
                fontSize: 14.5,
                lineHeight: 1.45,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {previewMsg}
            </div>
          </div>
        </>
      )}
      <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 6 }}>
        <div
          style={{
            maxWidth: "85%",
            background: C.bubbleBot,
            color: C.text,
            padding: 14,
            borderRadius: "10px 10px 10px 2px",
            border: `1px solid ${C.accent}33`,
          }}
        >
          <button
            onClick={onClick}
            style={{
              width: "100%",
              background: C.accent,
              color: "#0B141A",
              border: "none",
              borderRadius: 10,
              padding: "12px 14px",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {BOT_RESULT_CTA[archetype]}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// Copy de resultado específica do bot
//
// Diferente do quiz tradicional (RESULT_COPY de quiz-archetypes.ts), aqui
// o framing é "VOCÊ vai mandar uma mensagem pra equipe" — porque o CTA
// abre wa.me com mensagem pré-preenchida pra atendente. O lead é quem
// inicia a conversa, não a equipe.
// =============================================================

const BOT_RESULT_DESCRIPTION: Record<Archetype, string> = {
  PRONTA:
    "Toca no botão abaixo pra mandar uma mensagem pra equipe da Ju agora — a Gabi (ou Bárbara) já vai te receber pra alinhar o melhor horário.",
  ESPERANCOSA:
    "Toca aí e manda uma mensagem pra equipe. Eles vão te explicar como funciona a avaliação e as opções de parcelamento, sem pressão pra fechar.",
  CETICA:
    "Antes de qualquer avaliação, dá uma olhada nos destaques da Ju no Instagram — casos completos, antes/depois e as principais dúvidas. Quando fizer sentido, a porta fica aberta.",
};

const BOT_RESULT_CTA: Record<Archetype, string> = {
  PRONTA: "Mandar mensagem pra equipe →",
  ESPERANCOSA: "Mandar mensagem pra equipe →",
  CETICA: "Ver Instagram da Ju →",
};

// Renderiza *negrito* simples, escapando HTML
function ImageBubble({ src }: { src: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        margin: "6px 0",
      }}
    >
      <div
        style={{
          maxWidth: "78%",
          background: C.bubbleUser,
          padding: 3,
          borderRadius: "10px 10px 2px 10px",
          boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)",
          overflow: "hidden",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Foto enviada"
          style={{
            display: "block",
            width: "100%",
            maxWidth: 280,
            borderRadius: 8,
            objectFit: "cover",
          }}
        />
      </div>
    </div>
  );
}

function ImagePicker({
  uploading,
  error,
  onFile,
  onSkip,
}: {
  uploading: boolean;
  error: string | null;
  onFile: (f: File) => void;
  onSkip: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label
        style={{
          width: "100%",
          background: uploading ? "#1F3A33" : C.accent,
          color: uploading ? C.textDim : "#0B141A",
          border: "none",
          borderRadius: 12,
          padding: "14px 16px",
          fontSize: 16,
          fontWeight: 600,
          cursor: uploading ? "not-allowed" : "pointer",
          textAlign: "center",
          fontFamily: "inherit",
          pointerEvents: uploading ? "none" : "auto",
        }}
      >
        {uploading ? "Enviando…" : "📸 Tirar / escolher foto"}
        <input
          type="file"
          accept="image/*"
          capture="user"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>
      <button
        onClick={onSkip}
        disabled={uploading}
        style={{
          width: "100%",
          background: "transparent",
          color: C.textDim,
          border: "none",
          padding: "10px",
          fontSize: 14,
          cursor: uploading ? "not-allowed" : "pointer",
          textDecoration: "underline",
          fontFamily: "inherit",
        }}
      >
        Pular essa etapa
      </button>
      {error && (
        <div
          style={{
            color: "#f7a7a7",
            fontSize: 13,
            textAlign: "center",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

function renderText(raw: string): string {
  const escaped = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\*([^*]+)\*/g, "<b>$1</b>");
}

// Pattern sutil de fundo (SVG inline base64, doodle leve estilo WhatsApp)
const WHATSAPP_PATTERN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='412' height='412' viewBox='0 0 412 412' opacity='0.04'><g fill='%23ffffff'><circle cx='40' cy='40' r='2'/><circle cx='200' cy='80' r='1.5'/><circle cx='340' cy='160' r='2'/><circle cx='80' cy='280' r='1.5'/><circle cx='280' cy='340' r='2'/></g></svg>\")";

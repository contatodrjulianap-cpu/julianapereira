"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { trackEvent, getUtm } from "@/lib/track";
import { normalizePhone } from "@/lib/phone";
import type { Variant } from "@/lib/quiz-archetypes";

// Paleta oficial Sakura (verde/marrom neutro).
const C = {
  cream: "#E8E0D4",
  green: "#41482F",
  greenSoft: "#586046",
  brown: "#473631",
  rose: "#B18180",
  ink: "#2A2420",
  taupe: "#8a7a6e",
};

const SERIF = { fontFamily: "var(--font-gilda)" } as const;

type Incomoda = "cor" | "formato" | "espacos" | "desgaste" | "tudo";
type Tempo = "decidida" | "meses" | "curiosa";
type Cidade = "sp" | "br" | "intl";

const INCOMODA: { key: Incomoda; label: string }[] = [
  { key: "cor", label: "A cor / amarelado" },
  { key: "formato", label: "O formato / dentes tortos" },
  { key: "espacos", label: "Espaços entre os dentes" },
  { key: "desgaste", label: "Dentes gastos / quebrados" },
  { key: "tudo", label: "Quero renovar tudo" },
];
const TEMPO: { key: Tempo; label: string; sub: string }[] = [
  { key: "decidida", label: "Já decidi", sub: "só falta começar" },
  { key: "meses", label: "Há alguns meses", sub: "venho pesquisando" },
  { key: "curiosa", label: "Tô começando agora", sub: "só pesquisando" },
];
const CIDADE: { key: Cidade; label: string }[] = [
  { key: "sp", label: "São Paulo (capital ou região)" },
  { key: "br", label: "Outra cidade do Brasil" },
  { key: "intl", label: "Fora do Brasil" },
];

const ARQ: Record<Tempo, "PRONTA" | "ESPERANCOSA" | "CETICA"> = {
  decidida: "PRONTA",
  meses: "ESPERANCOSA",
  curiosa: "CETICA",
};
const GEO: Record<Cidade, "SP" | "BR" | "INTL"> = {
  sp: "SP",
  br: "BR",
  intl: "INTL",
};

export function Aplicacao({ variant }: { variant: Variant }) {
  const material = variant === "resina" ? "resina" : "porcelana";

  useEffect(() => {
    trackEvent("quiz_pageview", { variant, surface: "aplicacao" });
  }, [variant]);

  // ---- form state ----
  const [open, setOpen] = useState(false); // form revelado
  const [fstep, setFstep] = useState(0);
  const [incomoda, setIncomoda] = useState<Incomoda | null>(null);
  const [tempo, setTempo] = useState<Tempo | null>(null);
  const [cidade, setCidade] = useState<Cidade | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function startForm() {
    setOpen(true);
    trackEvent("quiz_step_view", { step: "aplicacao_form_start", variant });
    setTimeout(() => {
      document.getElementById("aplicar")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  async function submit() {
    if (!incomoda || !tempo || !cidade) return;
    const cleanPhone = normalizePhone(phone);
    if (name.trim().length < 2 || cleanPhone.length < 10) {
      setErr("Confere o nome e o WhatsApp 🌸");
      return;
    }
    setErr(null);
    setSending(true);
    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: cleanPhone,
          email: null,
          instagram: null,
          archetype: ARQ[tempo],
          geo: GEO[cidade],
          case_type: incomoda,
          scores: {},
          knockout: false,
          answers: { incomoda, tempo, cidade },
          selfie_path: null,
          variant,
          surface: "aplicacao",
          utm: getUtm(),
        }),
      });
      if (!res.ok) throw new Error("submit");
      trackEvent("quiz_step_view", { step: "aplicacao_submit", variant });
      window.location.href = `/aplicacao/obrigado?v=${variant}`;
    } catch {
      setSending(false);
      setErr("Deu um erro ao enviar. Tenta de novo?");
    }
  }

  return (
    <main style={{ background: C.cream, color: C.ink }} className="min-h-dvh">
      {/* ===== HERO ===== */}
      <section className="relative min-h-[62dvh] flex items-end overflow-hidden">
        <Image
          src="/aplicacao/foto-47.jpg"
          alt=""
          fill
          priority
          className="object-cover"
          style={{ objectPosition: "center 30%" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(0deg, rgba(20,14,12,.88) 0%, rgba(20,14,12,.35) 45%, rgba(20,14,12,.15) 100%)",
          }}
        />
        <div className="relative z-10 w-full max-w-xl mx-auto px-6 pb-14 text-center">
          <Image
            src="/aplicacao/logo-branco.png"
            alt="Clínica Sakura"
            width={300}
            height={150}
            className="w-56 h-auto mx-auto mb-8"
          />
          <h1
            className="text-white text-[2rem] sm:text-4xl leading-[1.1] mb-3"
            style={SERIF}
          >
            O sorriso muda{" "}
            <span style={{ color: C.rose, fontStyle: "italic" }}>tudo.</span>
          </h1>
          <p className="text-[#f0e7e1] text-base leading-relaxed mb-7 max-w-md mx-auto">
            Candidate-se a uma avaliação exclusiva com a Dra. Juliana Pereira.
            Lentes em {material}, naturais, planejadas no seu rosto.
          </p>
          <button
            onClick={startForm}
            className="rounded-full px-8 py-4 text-sm font-semibold tracking-wide"
            style={{ background: C.rose, color: "#3a2723" }}
          >
            Quero me candidatar
          </button>
        </div>
      </section>

      {/* ===== EMPATIA ===== */}
      <Section>
        <Eyebrow>Antes de tudo</Eyebrow>
        <H2>
          Não é sobre dentes. É sobre voltar a{" "}
          <em style={{ color: C.greenSoft }}>se reconhecer no espelho.</em>
        </H2>
        <Rule />
        <ul className="space-y-2.5 text-[#3a322f]">
          {[
            "Você sorri de boca fechada, tampa com a mão.",
            "Foge da foto, ou só posa de lábio fechado.",
            "Adia há anos: “um dia eu faço”.",
            "Já ouviu de algum dentista que “ia destruir seu dente”.",
          ].map((t) => (
            <li key={t} className="flex gap-2.5">
              <span style={{ color: C.rose }}>•</span>
              {t}
            </li>
          ))}
        </ul>
      </Section>

      {/* ===== FILOSOFIA ===== */}
      <section className="relative">
        <div className="relative h-[60dvh]">
          <Image
            src="/aplicacao/foto-06.jpg"
            alt=""
            fill
            className="object-cover"
            style={{ objectPosition: "center 28%" }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(20,14,12,.82) 0%, rgba(20,14,12,.3) 60%, transparent 100%)",
            }}
          />
          <div className="absolute inset-0 flex items-center">
            <div className="px-6 max-w-md">
              <Eyebrow light>A filosofia da Dra. Juliana</Eyebrow>
              <p
                className="text-white text-3xl italic leading-snug mt-3 mb-4"
                style={SERIF}
              >
                “Eu não destruo seu dente.
                <br />
                Eu <span style={{ color: C.rose }}>cuido</span> de você.”
              </p>
              <p className="text-[#ece2dc] text-sm leading-relaxed">
                Desgaste mínimo, planejamento prévio e resultado natural. Nada de
                “dente de Hollywood”: o objetivo é parecer você, só que livre pra
                sorrir.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CASOS ===== */}
      <Section>
        <Eyebrow>Casos reais · documentados</Eyebrow>
        <H2>Sorrisos que voltaram a aparecer</H2>
        <Rule />
        <div className="grid grid-cols-3 gap-2">
          {["foto-53", "foto-02", "foto-35"].map((f) => (
            <div key={f} className="relative aspect-[3/4] rounded-lg overflow-hidden">
              <Image src={`/aplicacao/${f}.jpg`} alt="" fill className="object-cover" />
            </div>
          ))}
        </div>
        <p className="text-xs mt-3" style={{ color: C.taupe }}>
          Cada caso tem um plano próprio. Você aprova o resultado antes de virar
          definitivo.
        </p>
      </Section>

      {/* ===== COMO FUNCIONA ===== */}
      <section style={{ background: C.brown }} className="py-14 px-6">
        <div className="max-w-xl mx-auto">
          <Eyebrow light>Previsibilidade do começo ao fim</Eyebrow>
          <h2 className="text-[#fff] text-3xl mt-2 mb-6" style={SERIF}>
            Como funciona
          </h2>
          <ol className="space-y-4">
            {[
              ["Avaliação", "Diagnóstico, fotos e um plano claro do seu caso."],
              ["Preparo", "Cuidados prévios quando o seu caso pede."],
              [
                "Prova do sorriso",
                "No mock-up você vê e aprova antes de virar definitivo.",
              ],
              ["Instalação", "O dia do sorriso novo, com a Ju conduzindo."],
              ["Manutenção", "Acompanhamento e 1ª manutenção inclusa."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span
                  className="shrink-0 text-2xl"
                  style={{ ...SERIF, color: C.rose }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="text-[#f3ece6] font-medium">{t}</p>
                  <p className="text-[#cbbfb6] text-sm">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <Section>
        <Eyebrow>As perguntas que todo mundo faz</Eyebrow>
        <H2>Suas dúvidas</H2>
        <Rule />
        <div className="space-y-4">
          {[
            ["“Vou destruir meu dente?”", "Não. Protocolo de desgaste mínimo, e a própria Ju fez nas dela."],
            ["“Vai ficar fake?”", "Nossa filosofia é o oposto: natural a ponto de ninguém perceber."],
            ["“Resina amarela?”", "Com a manutenção certa, mantém cor e brilho. A 1ª já vem inclusa."],
            ["“Não moro em SP.”", "Temos protocolo pra paciente de fora, com a equipe te recebendo."],
          ].map(([q, a]) => (
            <div key={q}>
              <p className="font-medium" style={{ color: C.green }}>
                {q}
              </p>
              <p className="text-sm text-[#3a322f]">{a}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ===== FORM (embutido) ===== */}
      <section id="aplicar" style={{ background: C.green }} className="px-6 py-16">
        <div className="max-w-md mx-auto">
          {!open ? (
            <div className="text-center">
              <h2 className="text-[#fff] text-3xl mb-3" style={SERIF}>
                Pronta pra começar?
              </h2>
              <p className="text-[#d9ddcf] text-sm mb-7">
                São poucas perguntas pra entender o seu caso e reservar a sua
                avaliação. Sem compromisso.
              </p>
              <button
                onClick={startForm}
                className="rounded-full px-8 py-4 text-sm font-semibold tracking-wide"
                style={{ background: C.rose, color: "#3a2723" }}
              >
                Quero me candidatar
              </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-white/95 p-6">
              <div className="flex gap-1.5 mb-5">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-1 flex-1 rounded-full"
                    style={{ background: i <= fstep ? C.rose : "#e2dccf" }}
                  />
                ))}
              </div>

              {fstep === 0 && (
                <FormStep title="O que mais te incomoda hoje no seu sorriso?">
                  <Choices
                    items={INCOMODA}
                    value={incomoda}
                    onPick={(k) => {
                      setIncomoda(k as Incomoda);
                      setFstep(1);
                    }}
                  />
                </FormStep>
              )}
              {fstep === 1 && (
                <FormStep title="Há quanto tempo você pensa em fazer?">
                  <Choices
                    items={TEMPO}
                    value={tempo}
                    onPick={(k) => {
                      setTempo(k as Tempo);
                      setFstep(2);
                    }}
                  />
                </FormStep>
              )}
              {fstep === 2 && (
                <FormStep title="Onde você mora?">
                  <Choices
                    items={CIDADE}
                    value={cidade}
                    onPick={(k) => {
                      setCidade(k as Cidade);
                      setFstep(3);
                    }}
                  />
                </FormStep>
              )}
              {fstep === 3 && (
                <FormStep title="Pra reservar a sua avaliação:">
                  <div className="space-y-3">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome"
                      className="w-full rounded-xl border border-[#d8cfc0] px-4 py-3 text-base outline-none"
                      style={{ color: C.ink }}
                    />
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      inputMode="tel"
                      placeholder="WhatsApp com DDD"
                      className="w-full rounded-xl border border-[#d8cfc0] px-4 py-3 text-base outline-none"
                      style={{ color: C.ink }}
                    />
                    {err && <p className="text-xs text-red-600">{err}</p>}
                    <button
                      onClick={submit}
                      disabled={sending}
                      className="w-full rounded-full px-8 py-4 text-sm font-semibold tracking-wide disabled:opacity-50"
                      style={{ background: C.brown, color: C.cream }}
                    >
                      {sending ? "Enviando…" : "Enviar minha aplicação"}
                    </button>
                  </div>
                </FormStep>
              )}

              {fstep > 0 && (
                <button
                  onClick={() => setFstep((s) => s - 1)}
                  className="mt-4 text-xs"
                  style={{ color: C.taupe }}
                >
                  ← voltar
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <footer className="text-center py-8 text-xs" style={{ color: C.taupe }}>
        Clínica Sakura · Odontologia Estética
      </footer>
    </main>
  );
}

/* ---------- bits ---------- */
function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="px-6 py-14">
      <div className="max-w-xl mx-auto">{children}</div>
    </section>
  );
}
function Eyebrow({
  children,
  light,
}: {
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <p
      className="text-[11px] font-semibold uppercase tracking-[0.35em]"
      style={{ color: light ? C.rose : C.greenSoft }}
    >
      {children}
    </p>
  );
}
function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-3xl leading-tight mt-2" style={{ fontFamily: "var(--font-gilda)", color: C.ink }}>
      {children}
    </h2>
  );
}
function Rule() {
  return (
    <div
      className="my-4 h-[2px] w-12 rounded-full"
      style={{ background: C.rose }}
    />
  );
}
function FormStep({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xl mb-4" style={{ fontFamily: "var(--font-gilda)", color: C.ink }}>
        {title}
      </h3>
      {children}
    </div>
  );
}
function Choices({
  items,
  value,
  onPick,
}: {
  items: { key: string; label: string; sub?: string }[];
  value: string | null;
  onPick: (k: string) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onPick(it.key)}
          className="w-full text-left rounded-xl border px-4 py-3.5 transition"
          style={{
            borderColor: value === it.key ? "#586046" : "#e2dccf",
            background: value === it.key ? "#f0efe6" : "#fff",
          }}
        >
          <span className="text-[15px] font-medium" style={{ color: "#2A2420" }}>
            {it.label}
          </span>
          {it.sub && (
            <span className="block text-xs text-[#8a7a6e]">{it.sub}</span>
          )}
        </button>
      ))}
    </div>
  );
}

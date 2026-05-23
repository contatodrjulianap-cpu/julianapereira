/**
 * Sakura Quiz — 8 perguntas canônicas (Funil-Quiz-Diagnostico.html)
 * + score por arquétipo (PRONTA · ESPERANÇOSA · CÉTICA)
 * + roteamento geográfico (SP · BR · INTERNACIONAL)
 * + gates de knock-out (capacidade financeira / urgência baixa → CÉTICA)
 */

export type Archetype = "PRONTA" | "ESPERANCOSA" | "CETICA";
export type Geo = "SP" | "BR" | "INTL";
export type Variant = "resina" | "porcelana";

export const VARIANTS = ["resina", "porcelana"] as const;

export function isVariant(v: string): v is Variant {
  return (VARIANTS as readonly string[]).includes(v);
}

// Ancoragem de preço do Q8 — range amplo pra qualificar capacidade financeira
// sem cravar o ticket exato (que sai depois pelo closer).
export const PRICE_ANCHOR: Record<Variant, { min: string; max: string }> = {
  resina: { min: "R$ 8.000,00", max: "R$ 60.000,00" },
  porcelana: { min: "R$ 25.000,00", max: "R$ 60.000,00" },
};

export const VARIANT_LABEL: Record<Variant, string> = {
  resina: "lentes de resina",
  porcelana: "lentes de porcelana",
};

// QuestionKey é string runtime-loaded da config DB.
// Hardcoded são os 8 keys canônicos (q1_caso, q2_urgencia_emocional, ...) mas
// o builder pode adicionar/renomear, então o tipo precisa ser aberto.
export type QuestionKey = string;

export type OptionWeight = Partial<Record<Archetype, number>>;

export type QuizOption = {
  value: string;
  label: string;
  emoji?: string;
  weights?: OptionWeight;
  geo?: Geo;
  knockout?: boolean; // marca CÉTICA / Instagram independente do score
  caseType?: string; // Q1: tipo de caso clínico
};

export type Question = {
  key: QuestionKey;
  num: number;
  title: string;
  subtitle?: string;
  options: QuizOption[];
  multi?: boolean;
  inputType?: "options" | "text";
  textPlaceholder?: string;
};

export const QUESTIONS: Question[] = [
  {
    key: "q1_caso",
    num: 1,
    title: "O que mais te incomoda quando você se vê no espelho hoje?",
    subtitle: "Pode marcar mais de uma — sem rodeio, o que te trava na hora de sorrir.",
    multi: true,
    options: [
      { value: "cor", label: "Cor — meus dentes parecem amarelados ou manchados", caseType: "clareamento+lentes", emoji: "🌕" },
      { value: "formato", label: "Formato — alguns dentes são tortos, curtos ou diferentes", caseType: "alinhamento", emoji: "🦷" },
      { value: "espacos", label: "Espaços, dente quebrado ou desgaste por bruxismo", caseType: "reconstrucao", emoji: "✨" },
      { value: "revisao", label: "Já fiz tratamento e não fiquei satisfeita", caseType: "revisao", emoji: "🔄" },
      { value: "aberta", label: "Não sei explicar — só sei que não gosto de me ver sorrindo", caseType: "avaliacao_aberta", emoji: "💭" },
    ],
  },
  {
    key: "q2_evita_sorrir",
    num: 2,
    title: "Você evita sorrir em fotos?",
    subtitle: "Honestidade total — quanto mais forte o sinal, mais a equipe consegue te ajudar.",
    options: [
      { value: "sempre", label: "Sempre — coloco a mão na boca ou desvio", weights: { PRONTA: 4 }, emoji: "🙈" },
      { value: "frequente", label: "Frequentemente — em fotos importantes evito", weights: { PRONTA: 3 }, emoji: "📸" },
      { value: "as_vezes", label: "Às vezes — depende do dia ou do ângulo", weights: { ESPERANCOSA: 2 }, emoji: "🤷‍♀️" },
      { value: "raramente", label: "Raramente — sorrio normal na maioria delas", weights: { CETICA: 2 }, emoji: "😊" },
    ],
  },
  {
    key: "q3_objecao",
    num: 3,
    title: "Qual a sua maior dúvida na decisão de fazer lentes?",
    subtitle: "A dúvida real — a que faz você adiar a decisão.",
    options: [
      { value: "destruir_dente", label: "Medo de destruir o dente natural", weights: { CETICA: 3 }, emoji: "🛡️" },
      { value: "fake", label: "Medo do resultado ficar fake / Hollywood", weights: { CETICA: 3 }, emoji: "✨" },
      { value: "amarelar", label: 'Já ouvi que "lente amarela / não dura"', weights: { CETICA: 3 }, emoji: "📉" },
      { value: "investimento", label: "Investimento — preciso entender o parcelamento", weights: { ESPERANCOSA: 3 }, emoji: "💳" },
      { value: "caso_possivel", label: "Não sei se sou um caso possível", weights: { ESPERANCOSA: 2 }, emoji: "🤔" },
    ],
  },
  {
    key: "q4_profissao",
    num: 4,
    title: "Em qual profissão você trabalha atualmente?",
    subtitle: "A Ju adapta o plano ao seu momento profissional — pode escrever do seu jeito.",
    inputType: "text",
    textPlaceholder: "Ex.: empresária, médica, arquiteta, criadora de conteúdo...",
    options: [],
  },
  {
    key: "q5_expectativa",
    num: 5,
    title: "Como você imagina o seu resultado ideal?",
    subtitle: "Alinhamento de expectativa antes da consulta.",
    options: [
      { value: "branco_alinhado", label: "Bem mais branco e perfeitamente alinhado", weights: { ESPERANCOSA: 1 } },
      { value: "natural", label: "Natural — mais bonito, mas que continue parecendo meu", weights: { PRONTA: 2 } },
      { value: "pontual", label: "Resolver pontos específicos sem mudar tudo", weights: { ESPERANCOSA: 1 } },
      { value: "casos_antes", label: "Quero ver casos antes de decidir", weights: { CETICA: 1 } },
    ],
  },
  {
    key: "q6_geo",
    num: 6,
    title: "Você mora em São Paulo ou consegue vir até a clínica?",
    subtitle: "Roteamento operacional — define o protocolo de atendimento.",
    options: [
      { value: "sp", label: "SP / Grande SP / até 100km", geo: "SP", weights: { PRONTA: 2 } },
      { value: "br_1dia", label: "Outra cidade do Brasil — consigo me deslocar 1 dia", geo: "BR", weights: { ESPERANCOSA: 1 } },
      { value: "br_multi", label: "Outra cidade — preciso de protocolo (porcelana / múltiplas visitas)", geo: "BR", weights: { ESPERANCOSA: 1 } },
      { value: "internacional", label: "Fora do Brasil", geo: "INTL", weights: { ESPERANCOSA: 1 } },
    ],
  },
  {
    key: "q7_urgencia_temporal",
    num: 7,
    title: "Em quanto tempo você gostaria de transformar seu sorriso?",
    subtitle: "Define a prioridade no funil.",
    options: [
      { value: "30d", label: "Próximos 30 dias — quero resolver", weights: { PRONTA: 3 } },
      { value: "3m", label: "Próximos 3 meses", weights: { ESPERANCOSA: 2 } },
      { value: "ano", label: "Esse ano", weights: { ESPERANCOSA: 1 } },
      { value: "planejando", label: "Ainda planejando — quero entender mais", weights: { CETICA: 2 } },
    ],
  },
  {
    key: "q8_orcamento",
    num: 8,
    // Title genérico (sem preço). Cada variant injeta sua faixa via getQuestionsFor().
    title: "Cabe no seu orçamento atual?",
    subtitle:
      "Honestidade total — direciona o atendimento certo, sem pressão.",
    options: [
      { value: "cabe_avista", label: "Sim. Cabe no meu orçamento.", weights: { PRONTA: 4 }, emoji: "✅" },
      { value: "cabe_parcelado", label: "Sim. Cabe no meu orçamento, mas parcelado.", weights: { PRONTA: 2 }, emoji: "💳" },
      { value: "nao_cabe", label: "Não. Não cabe no meu orçamento.", weights: { CETICA: 3 }, knockout: true, emoji: "🚫" },
      { value: "info", label: "Só estou buscando informações.", weights: { CETICA: 2 }, knockout: true, emoji: "🔍" },
    ],
  },
];

// ====================================================
// Per-variant question overrides
// Q8 é a única pergunta que muda entre resina e porcelana (ancoragem de preço).
// Builder pode sobrescrever via DB; aqui ficam os defaults hardcoded.
// ====================================================

export function getQuestionsFor(variant: Variant): Question[] {
  const anchor = PRICE_ANCHOR[variant];
  const variantLabel = VARIANT_LABEL[variant];
  return QUESTIONS.map((q) => {
    if (q.key !== "q8_orcamento") return q;
    return {
      ...q,
      title: `O tratamento de ${variantLabel} com a Dra. Juliana vai de ${anchor.min} a ${anchor.max}. Cabe no seu orçamento atual?`,
    };
  });
}

// ====================================================
// Score → Bucket
// ====================================================

export type AnswerValue = string | string[];
export type Answers = Record<QuestionKey, AnswerValue>;

export type ScoreResult = {
  archetype: Archetype;
  geo: Geo;
  caseType: string | null;
  scores: Record<Archetype, number>;
  knockout: boolean;
};

export function scoreAnswers(
  answers: Record<string, AnswerValue>,
  questions: Question[] = QUESTIONS,
): ScoreResult {
  const scores: Record<Archetype, number> = { PRONTA: 0, ESPERANCOSA: 0, CETICA: 0 };
  let geo: Geo = "SP";
  const caseTypes: string[] = [];
  let knockout = false;

  for (const q of questions) {
    const ans = answers[q.key];
    if (!ans) continue;
    // Text input: vai pro CRM como contexto, sem score
    if (q.inputType === "text") continue;
    const selected = Array.isArray(ans) ? ans : [ans];
    for (const value of selected) {
      const opt = q.options.find((o) => o.value === value);
      if (!opt) continue;

      if (opt.weights) {
        for (const [arch, w] of Object.entries(opt.weights)) {
          scores[arch as Archetype] += w as number;
        }
      }
      if (opt.geo) geo = opt.geo;
      if (opt.caseType && !caseTypes.includes(opt.caseType)) caseTypes.push(opt.caseType);
      if (opt.knockout) knockout = true;
    }
  }

  const caseType = caseTypes.length > 0 ? caseTypes.join(", ") : null;

  // Knockout (Q7.5 = "preciso conversar antes") força CÉTICA → Instagram da Ju
  if (knockout) {
    return { archetype: "CETICA", geo, caseType, scores, knockout: true };
  }

  // Maior peso vence; em empate, prioriza PRONTA > ESPERANCOSA > CETICA
  const order: Archetype[] = ["PRONTA", "ESPERANCOSA", "CETICA"];
  let archetype: Archetype = "ESPERANCOSA";
  let max = -Infinity;
  for (const a of order) {
    if (scores[a] > max) {
      max = scores[a];
      archetype = a;
    }
  }

  return { archetype, geo, caseType, scores, knockout: false };
}

// ====================================================
// Mensagens WhatsApp pré-preenchidas (link wa.me)
// Número de destino é decidido pelo server (`/api/quiz/wa-link`) via
// round-robin sticky entre as atendentes ativas. Ver `lib/wa-router.ts`.
// ====================================================

export function whatsappMessageFor(
  archetype: Archetype,
  firstName: string,
  variant?: Variant,
): string {
  const nome = firstName.trim() || "tudo bem";
  const plano = variant ? ` (Plano ${variant === "resina" ? "Resina" : "Porcelana"})` : "";
  switch (archetype) {
    case "PRONTA":
      return `Oi! Sou a/o ${nome}, respondi as 8 perguntas${plano} e quero marcar uma avaliação com a equipe da Dra. Juliana ainda essa semana. Que horários têm?`;
    case "ESPERANCOSA":
      return `Oi! Sou a/o ${nome}, respondi as 8 perguntas do quiz da Dra. Juliana${plano}. Tenho interesse em fazer mas queria entender como funciona a avaliação e as opções de parcelamento antes. Pode me explicar?`;
    case "CETICA":
      return `Oi! Sou a/o ${nome}, fiz o quiz da Dra. Juliana${plano} e quero conversar sobre minhas dúvidas antes de qualquer decisão.`;
  }
}

// ====================================================
// Copy do resultado por arquétipo
// ====================================================

export type ResultCopy = {
  badge: string;
  title: string;
  description: string;
  ctaPrimary: { label: string; href: (firstName: string) => string };
  ctaSecondary?: { label: string; href: string };
  tone: "rose" | "cream" | "cocoa";
};

export const INSTAGRAM_URL = "https://www.instagram.com/drajuliana.pereira/";

export const RESULT_COPY: Record<Archetype, ResultCopy> = {
  PRONTA: {
    badge: "Pronta pra avaliação",
    title: "Você está no momento certo.",
    description:
      "Pelo que você respondeu, tá pronta pra avaliação. A equipe te chama no WhatsApp pra alinhar a agenda.",
    tone: "rose",
    ctaPrimary: {
      label: "Falar com a equipe da Ju agora →",
      // href resolvido em runtime pelo /api/quiz/wa-link (round-robin sticky entre as atendentes)
      href: () => "",
    },
  },
  ESPERANCOSA: {
    badge: "Vale uma avaliação",
    title: "Tem caminho — começa por uma avaliação.",
    description:
      "Você tem o desejo claro, mas ainda quer entender investimento e como funciona pro seu caso. A equipe te chama no WhatsApp pra tirar dúvida antes de qualquer agendamento — sem pressão pra fechar.",
    tone: "cream",
    ctaPrimary: {
      label: "Quero entender o caminho →",
      href: () => "",
    },
  },
  CETICA: {
    badge: "Acompanhe a Ju por dentro",
    title: "Antes da avaliação, vale conhecer melhor.",
    description:
      "Dá uma olhada nos destaques do Instagram da Ju — casos completos paciente por paciente, antes/depois, bastidores e as principais dúvidas (resina amarela, fake, desgaste). Quando fizer sentido, a porta fica aberta.",
    tone: "cocoa",
    ctaPrimary: {
      label: "Ver destaques no Instagram →",
      href: () => INSTAGRAM_URL,
    },
  },
};

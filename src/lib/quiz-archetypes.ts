/**
 * Sakura Quiz — 8 perguntas canônicas (Funil-Quiz-Diagnostico.html)
 * + score por arquétipo (PRONTA · ESPERANÇOSA · CÉTICA)
 * + roteamento geográfico (SP · BR · INTERNACIONAL)
 * + gates de knock-out (capacidade financeira / urgência baixa → CÉTICA)
 */

export type Archetype = "PRONTA" | "ESPERANCOSA" | "CETICA";
export type Geo = "SP" | "BR" | "INTL";

export type QuestionKey =
  | "q1_caso"
  | "q2_urgencia_emocional"
  | "q3_objecao"
  | "q4_lente_amarela"
  | "q5_expectativa"
  | "q6_geo"
  | "q7_urgencia_temporal"
  | "q7_5_capacidade";

export type OptionWeight = Partial<Record<Archetype, number>>;

export type QuizOption = {
  value: string;
  label: string;
  emoji?: string;
  weights?: OptionWeight;
  geo?: Geo;
  knockout?: true; // marca CÉTICA / Instagram independente do score
  caseType?: string; // Q1: tipo de caso clínico
};

export type Question = {
  key: QuestionKey;
  num: number;
  title: string;
  subtitle?: string;
  options: QuizOption[];
};

export const QUESTIONS: Question[] = [
  {
    key: "q1_caso",
    num: 1,
    title: "O que mais te incomoda quando você se vê no espelho hoje?",
    subtitle: "Sem rodeio — o que te trava na hora de sorrir.",
    options: [
      { value: "cor", label: "Cor — meus dentes parecem amarelados ou manchados", caseType: "clareamento+lentes", emoji: "🌕" },
      { value: "formato", label: "Formato — alguns dentes são tortos, curtos ou diferentes", caseType: "alinhamento", emoji: "🦷" },
      { value: "espacos", label: "Espaços, dente quebrado ou desgaste por bruxismo", caseType: "reconstrucao", emoji: "✨" },
      { value: "revisao", label: "Já fiz tratamento e não fiquei satisfeita", caseType: "revisao", emoji: "🔄" },
      { value: "aberta", label: "Não sei explicar — só sei que não gosto de me ver sorrindo", caseType: "avaliacao_aberta", emoji: "💭" },
    ],
  },
  {
    key: "q2_urgencia_emocional",
    num: 2,
    title: "Quando foi a última vez que você sorriu numa foto sem travar?",
    subtitle: "Quanto mais antiga a memória, mais forte o sinal.",
    options: [
      { value: "hoje", label: "Hoje, sorrio normal nas fotos", weights: { CETICA: 2 }, emoji: "📸" },
      { value: "meses", label: "Faz alguns meses", weights: { ESPERANCOSA: 2 }, emoji: "🗓️" },
      { value: "1ano", label: "Faz mais de 1 ano", weights: { PRONTA: 3 }, emoji: "⏳" },
      { value: "mao_boca", label: "Nem lembro — eu rio com a mão na frente da boca", weights: { PRONTA: 4 }, emoji: "🙈" },
    ],
  },
  {
    key: "q3_objecao",
    num: 3,
    title: "Qual a sua maior trava na decisão de fazer lentes?",
    subtitle: "A objeção real — a que faz você adiar a decisão.",
    options: [
      { value: "destruir_dente", label: "Medo de destruir o dente natural", weights: { CETICA: 3 }, emoji: "🛡️" },
      { value: "fake", label: "Medo do resultado ficar fake / Hollywood", weights: { CETICA: 3 }, emoji: "✨" },
      { value: "amarelar", label: 'Já ouvi que "lente amarela / não dura"', weights: { CETICA: 3 }, emoji: "📉" },
      { value: "investimento", label: "Investimento — preciso entender o parcelamento", weights: { ESPERANCOSA: 3 }, emoji: "💳" },
      { value: "caso_possivel", label: "Não sei se sou um caso possível", weights: { ESPERANCOSA: 2 }, emoji: "🤔" },
    ],
  },
  {
    key: "q4_lente_amarela",
    num: 4,
    title: 'Você já ouviu / leu que "lente amarela rápido"?',
    subtitle: "Honestidade total. Tudo depende do PROFISSIONAL.",
    options: [
      { value: "sim_trava", label: "Sim, e isso me trava bastante", weights: { CETICA: 2 } },
      { value: "sim_confio", label: "Sim, mas confio no trabalho da Ju", weights: { ESPERANCOSA: 2 } },
      { value: "primeira_vez", label: "Não — primeira vez que ouço", weights: { PRONTA: 2 } },
    ],
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
    key: "q7_5_capacidade",
    num: 8,
    title: "Pra fazer caber no seu plano, qual parcelamento faria sentido pra você?",
    subtitle:
      "Tratamento sério tem investimento sério. Sem julgar resposta — apenas pra direcionar o caminho certo.",
    options: [
      { value: "vista_6x", label: "Posso pagar à vista ou em até 6x", weights: { PRONTA: 3 } },
      { value: "12x", label: "Preciso parcelar em até 12x no cartão", weights: { ESPERANCOSA: 3 } },
      { value: "pix_boleto", label: "Prefiro PIX parcelado ou boleto (entrada de ~30%)", weights: { ESPERANCOSA: 2 } },
      { value: "conversar", label: "Preciso conversar antes de pensar em valor", knockout: true, weights: { CETICA: 3 } },
    ],
  },
];

// ====================================================
// Score → Bucket
// ====================================================

export type Answers = Record<QuestionKey, string>;

export type ScoreResult = {
  archetype: Archetype;
  geo: Geo;
  caseType: string | null;
  scores: Record<Archetype, number>;
  knockout: boolean;
};

export function scoreAnswers(answers: Partial<Answers>): ScoreResult {
  const scores: Record<Archetype, number> = { PRONTA: 0, ESPERANCOSA: 0, CETICA: 0 };
  let geo: Geo = "SP";
  let caseType: string | null = null;
  let knockout = false;

  for (const q of QUESTIONS) {
    const ans = answers[q.key];
    if (!ans) continue;
    const opt = q.options.find((o) => o.value === ans);
    if (!opt) continue;

    if (opt.weights) {
      for (const [arch, w] of Object.entries(opt.weights)) {
        scores[arch as Archetype] += w as number;
      }
    }
    if (opt.geo) geo = opt.geo;
    if (opt.caseType) caseType = opt.caseType;
    if (opt.knockout) knockout = true;
  }

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
// ====================================================

export const WHATSAPP_NUMBER = "5521995040731"; // trocar pelo número da Ju/Sakura quando for usar de verdade

export function whatsappLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function whatsappMessageFor(
  archetype: Archetype,
  firstName: string,
): string {
  const nome = firstName.trim() || "tudo bem";
  switch (archetype) {
    case "PRONTA":
      return `Oi! Sou a/o ${nome}, fiz o quiz da Dra. Juliana e o resultado foi *Sorriso Pronto pra Avaliação*. Faz tempo que esse é meu sonho — quero marcar a avaliação ainda essa semana. Que horários têm?`;
    case "ESPERANCOSA":
      return `Oi! Sou a/o ${nome}, fiz o quiz da Dra. Juliana e o resultado foi *Sorriso em Cuidado*. Tenho interesse em fazer mas queria entender como funciona a avaliação e as opções de parcelamento. Pode me explicar?`;
    case "CETICA":
      return `Oi! Sou a/o ${nome}, fiz o quiz da Dra. Juliana e quero conversar sobre minhas dúvidas antes de qualquer decisão.`;
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

export const INSTAGRAM_URL = "https://instagram.com/drajulianap.pereira"; // confirmar handle

export const RESULT_COPY: Record<Archetype, ResultCopy> = {
  PRONTA: {
    badge: "Sorriso Pronto pra Avaliação",
    title: "Você está no momento certo.",
    description:
      "Pelo que você respondeu, sua decisão já está tomada. O próximo passo é alinhar agenda — a equipe da Ju vai te receber pra montar o plano específico do seu caso.",
    tone: "rose",
    ctaPrimary: {
      label: "Falar com a equipe da Ju agora →",
      href: (firstName) => whatsappLink(whatsappMessageFor("PRONTA", firstName)),
    },
  },
  ESPERANCOSA: {
    badge: "Sorriso em Cuidado",
    title: "Tem caminho — começa por uma avaliação.",
    description:
      "Você tem o desejo claro mas precisa entender investimento e como funciona pro seu caso. Faz sentido — o plano só fica certo depois de uma avaliação personalizada (não é tabela). Vamos conversar.",
    tone: "cream",
    ctaPrimary: {
      label: "Quero entender o caminho →",
      href: (firstName) => whatsappLink(whatsappMessageFor("ESPERANCOSA", firstName)),
    },
  },
  CETICA: {
    badge: "Acompanhe a Ju por dentro",
    title: "Antes da avaliação, vale conhecer melhor.",
    description:
      "Você ainda está pesquisando — e isso é saudável. A Ju posta no Instagram bastidores, casos reais e quebra das principais dúvidas (resina amarela, fake, desgaste). Quando fizer sentido, a porta fica aberta.",
    tone: "cocoa",
    ctaPrimary: {
      label: "Seguir @drajulianap.pereira no Instagram →",
      href: () => INSTAGRAM_URL,
    },
  },
};

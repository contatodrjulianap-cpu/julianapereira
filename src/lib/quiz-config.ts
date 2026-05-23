import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getQuestionsFor,
  RESULT_COPY as HARDCODED_RESULTS,
  INSTAGRAM_URL,
  PRICE_ANCHOR,
  VARIANT_LABEL,
  type Archetype,
  type Question,
  type Variant,
} from "./quiz-archetypes";

const GeoEnum = z.enum(["SP", "BR", "INTL"]);

const WeightsSchema = z.object({
  PRONTA: z.number().optional(),
  ESPERANCOSA: z.number().optional(),
  CETICA: z.number().optional(),
});

const OptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  emoji: z.string().optional(),
  weights: WeightsSchema.optional(),
  geo: GeoEnum.optional(),
  knockout: z.boolean().optional(),
  caseType: z.string().optional(),
});

const QuestionSchema = z
  .object({
    key: z.string().min(1),
    num: z.number(),
    title: z.string().min(1),
    subtitle: z.string().optional(),
    options: z.array(OptionSchema),
    multi: z.boolean().optional(),
    inputType: z.enum(["options", "text"]).optional(),
    textPlaceholder: z.string().optional(),
  })
  .refine(
    (q) => q.inputType === "text" || q.options.length >= 1,
    { message: "options is required when inputType is not 'text'" },
  );

const ResultCopySchema = z.object({
  badge: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  ctaLabel: z.string().min(1),
  tone: z.enum(["rose", "cream", "cocoa"]).optional(),
});

const CoverSchema = z.object({
  badge: z.string().min(1),
  headline: z.string().min(1),
  headline_highlight: z.string().min(1),
  subtitle1: z.string().min(1),
  subtitle2: z.string().optional(),
  cta_label: z.string().min(1),
  legal: z.string().min(1),
  image_path: z.string().optional(),
});

const CommitmentSchema = z.object({
  pre_title: z.string().min(1),
  body: z.string().min(1),
  question: z.string().min(1),
  yes_label: z.string().min(1),
  no_label: z.string().min(1),
});

export const QuizConfigSchema = z.object({
  cover: CoverSchema.optional(),
  commitment: CommitmentSchema.optional(),
  questions: z.array(QuestionSchema).min(1),
  results: z.object({
    PRONTA: ResultCopySchema,
    ESPERANCOSA: ResultCopySchema,
    CETICA: ResultCopySchema,
  }),
  // Legado: número era único, hoje vem de wa_numbers via /api/quiz/wa-link.
  // Mantido opcional pra não quebrar parse de quiz_config antigos no DB.
  whatsapp_number: z.string().optional(),
  instagram_url: z.string().url(),
});

export type QuizConfig = z.infer<typeof QuizConfigSchema>;

// Default por variant — Q8 já vem com preço da variant, cover aponta pra
// imagem específica (`/quiz/case-<variant>.jpg`), headline menciona o material.
export function DEFAULT_CONFIG_FOR(variant: Variant): QuizConfig {
  const planoLabel = variant === "resina" ? "Resina" : "Porcelana";
  const matLabel = VARIANT_LABEL[variant];
  return {
    cover: {
      badge: `Avaliação · Plano ${planoLabel}`,
      headline: "Responda esse questionário rápido,",
      headline_highlight: `para iniciar sua avaliação de ${matLabel}`,
      subtitle1:
        "Ao final, preenchendo os requisitos você será direcionado pro WhatsApp pra agendar sua avaliação.",
      cta_label: "Começar →",
      legal: "Suas respostas são tratadas com sigilo (LGPD).",
      image_path: `/quiz/img_${variant}.jpeg`,
    },
    commitment: {
      pre_title: "Antes de começar:",
      body:
        "Quanto mais honesta a resposta, melhor a equipe consegue te receber. Não tem resposta certa nem errada — só direciona o atendimento.",
      question: "Topa responder com sinceridade?",
      yes_label: "Topo, vamos",
      no_label: "Ainda não tenho certeza",
    },
    questions: getQuestionsFor(variant) as Question[],
    results: {
      PRONTA: {
        badge: HARDCODED_RESULTS.PRONTA.badge,
        title: HARDCODED_RESULTS.PRONTA.title,
        description: HARDCODED_RESULTS.PRONTA.description,
        ctaLabel: HARDCODED_RESULTS.PRONTA.ctaPrimary.label,
        tone: HARDCODED_RESULTS.PRONTA.tone,
      },
      ESPERANCOSA: {
        badge: HARDCODED_RESULTS.ESPERANCOSA.badge,
        title: HARDCODED_RESULTS.ESPERANCOSA.title,
        description: HARDCODED_RESULTS.ESPERANCOSA.description,
        ctaLabel: HARDCODED_RESULTS.ESPERANCOSA.ctaPrimary.label,
        tone: HARDCODED_RESULTS.ESPERANCOSA.tone,
      },
      CETICA: {
        badge: HARDCODED_RESULTS.CETICA.badge,
        title: HARDCODED_RESULTS.CETICA.title,
        description: HARDCODED_RESULTS.CETICA.description,
        ctaLabel: HARDCODED_RESULTS.CETICA.ctaPrimary.label,
        tone: HARDCODED_RESULTS.CETICA.tone,
      },
    },
    instagram_url: INSTAGRAM_URL,
  };
}

/**
 * Lê config do DB pra uma variant. Em caso de erro/ausência/parse fail,
 * retorna DEFAULT_CONFIG_FOR(variant).
 * Chamado tanto pelo /quiz/[variant] (server) quanto pelo /crm/builder.
 */
export async function getQuizConfig(variant: Variant): Promise<QuizConfig> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("quiz_config")
      .select("config")
      .eq("id", variant)
      .maybeSingle();

    if (error) {
      console.error("getQuizConfig db error", { variant, error });
      return DEFAULT_CONFIG_FOR(variant);
    }

    if (!data?.config || Object.keys(data.config as object).length === 0) {
      return DEFAULT_CONFIG_FOR(variant);
    }

    const parsed = QuizConfigSchema.safeParse(data.config);
    if (!parsed.success) {
      console.error("quiz_config invalid schema, fallback", {
        variant,
        issues: parsed.error.issues,
      });
      return DEFAULT_CONFIG_FOR(variant);
    }
    return parsed.data;
  } catch (e) {
    console.error("getQuizConfig threw", { variant, e });
    return DEFAULT_CONFIG_FOR(variant);
  }
}

export type { Archetype, Variant };

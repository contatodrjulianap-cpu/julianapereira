import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import {
  QUESTIONS as HARDCODED_QUESTIONS,
  RESULT_COPY as HARDCODED_RESULTS,
  WHATSAPP_NUMBER,
  INSTAGRAM_URL,
  type Archetype,
  type Question,
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

const QuestionSchema = z.object({
  key: z.string().min(1),
  num: z.number(),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  options: z.array(OptionSchema).min(1),
});

const ResultCopySchema = z.object({
  badge: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  ctaLabel: z.string().min(1),
  tone: z.enum(["rose", "cream", "cocoa"]).optional(),
});

export const QuizConfigSchema = z.object({
  questions: z.array(QuestionSchema).min(1),
  results: z.object({
    PRONTA: ResultCopySchema,
    ESPERANCOSA: ResultCopySchema,
    CETICA: ResultCopySchema,
  }),
  whatsapp_number: z.string().min(1),
  instagram_url: z.string().url(),
});

export type QuizConfig = z.infer<typeof QuizConfigSchema>;

// Default a partir do hardcoded em quiz-archetypes.ts
export const DEFAULT_CONFIG: QuizConfig = {
  questions: HARDCODED_QUESTIONS as Question[],
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
  whatsapp_number: WHATSAPP_NUMBER,
  instagram_url: INSTAGRAM_URL,
};

/**
 * Lê config do DB. Em caso de erro/ausência/parse fail, retorna DEFAULT_CONFIG.
 * Chamado tanto pelo /quiz (server) quanto pelo /crm/builder.
 */
export async function getQuizConfig(): Promise<QuizConfig> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("quiz_config")
      .select("config")
      .eq("id", "current")
      .maybeSingle();

    if (error) {
      console.error("getQuizConfig db error", error);
      return DEFAULT_CONFIG;
    }

    if (!data?.config || Object.keys(data.config as object).length === 0) {
      return DEFAULT_CONFIG;
    }

    const parsed = QuizConfigSchema.safeParse(data.config);
    if (!parsed.success) {
      console.error("quiz_config invalid schema, fallback", parsed.error.issues);
      return DEFAULT_CONFIG;
    }
    return parsed.data;
  } catch (e) {
    console.error("getQuizConfig threw", e);
    return DEFAULT_CONFIG;
  }
}

export type { Archetype };

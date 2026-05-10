import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";

const WhatsappGreetingSchema = z.object({
  enabled: z.boolean(),
  message: z.string().min(1),
});

const FbEventSchema = z.object({
  enabled: z.boolean(),
  event_name: z.string().min(1),
  content_name: z.string().optional(),
});

export const IntegrationConfigSchema = z.object({
  whatsapp: z.object({
    greetings: z.object({
      PRONTA: WhatsappGreetingSchema,
      ESPERANCOSA: WhatsappGreetingSchema,
      CETICA: WhatsappGreetingSchema,
    }),
  }),
  facebook: z.object({
    pageview: FbEventSchema, // dispara quando user abre /quiz
    quiz_submit: FbEventSchema, // dispara quando user finaliza quiz
    wa_click: FbEventSchema, // dispara quando user clica pra WhatsApp na tela de resultado
  }),
});

export type IntegrationConfig = z.infer<typeof IntegrationConfigSchema>;

export const DEFAULT_INTEGRATION_CONFIG: IntegrationConfig = {
  whatsapp: {
    greetings: {
      PRONTA: {
        enabled: true,
        message:
          "Oi {name}! 🌸 Recebi o resultado do seu quiz aqui — *Sorriso Pronto pra Avaliação*. A Ju vai te chamar nas próximas horas pra alinhar agenda. Se quiser adiantar, me responde aqui que já te passo os horários disponíveis.",
      },
      ESPERANCOSA: {
        enabled: true,
        message:
          "Oi {name}! 🌸 Vi seu quiz aqui — você está no momento de entender o caminho certo. O plano não é tabela, depende do seu caso. A avaliação personalizada com a Ju (ou com a equipe) é onde tudo se define, inclusive o parcelamento. Posso te explicar como funciona?",
      },
      CETICA: {
        enabled: false,
        message:
          "Oi {name}! Vi seu quiz. Quando fizer sentido, posso te tirar dúvidas — sem pressão.",
      },
    },
  },
  facebook: {
    pageview: {
      enabled: true,
      event_name: "PageView",
      content_name: "quiz_pageview",
    },
    quiz_submit: {
      enabled: true,
      event_name: "Lead",
      content_name: "quiz_submission",
    },
    wa_click: {
      enabled: true,
      event_name: "AddToCart",
      content_name: "wa_click",
    },
  },
};

export async function getIntegrationConfig(): Promise<IntegrationConfig> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("integration_config")
      .select("config")
      .eq("id", "current")
      .maybeSingle();

    if (error) {
      console.error("getIntegrationConfig db error", error);
      return DEFAULT_INTEGRATION_CONFIG;
    }
    if (!data?.config || Object.keys(data.config as object).length === 0) {
      return DEFAULT_INTEGRATION_CONFIG;
    }
    const parsed = IntegrationConfigSchema.safeParse(data.config);
    if (!parsed.success) {
      console.error("integration_config invalid, fallback", parsed.error.issues);
      return DEFAULT_INTEGRATION_CONFIG;
    }
    return parsed.data;
  } catch (e) {
    console.error("getIntegrationConfig threw", e);
    return DEFAULT_INTEGRATION_CONFIG;
  }
}

export function renderGreeting(template: string, name: string): string {
  return template.replace(/\{name\}/g, name.split(" ")[0] || "tudo bem");
}

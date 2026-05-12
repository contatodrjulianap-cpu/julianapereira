// Schema + types + render — puro, client-safe (sem next/headers).
// Server-side loader fica em integration-config-server.ts.
import { z } from "zod";

const WhatsappGreetingSchema = z.object({
  enabled: z.boolean(),
  message: z.string().min(1),
});

const ArchetypeSchema = z.enum(["PRONTA", "ESPERANCOSA", "CETICA"]);

const FbEventSchema = z.object({
  enabled: z.boolean(),
  event_name: z.string().min(1),
  content_name: z.string().optional(),
  // Filtro opcional por arquétipo. undefined = todos disparam (back-compat).
  // Aplica em quiz_submit e wa_click; pageview ignora (não tem archetype ainda).
  archetypes: z.array(ArchetypeSchema).optional(),
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
      archetypes: ["PRONTA", "ESPERANCOSA"],
    },
    wa_click: {
      enabled: true,
      event_name: "AddToCart",
      content_name: "wa_click",
      archetypes: ["PRONTA", "ESPERANCOSA"],
    },
  },
};

export function renderGreeting(template: string, name: string): string {
  return template.replace(/\{name\}/g, name.split(" ")[0] || "tudo bem");
}

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
          "Oi {name}! 🌸 Recebi suas respostas aqui — você está pronta pra avaliação. Tô aqui pra te alinhar a agenda, me responde que já te passo os horários disponíveis.",
      },
      ESPERANCOSA: {
        enabled: true,
        message:
          "Oi {name}! 🌸 Vi suas respostas aqui — você ainda quer entender melhor antes de decidir, faz total sentido. Investimento e parcelamento são definidos na avaliação com a equipe (não temos tabela). Posso te explicar como funciona?",
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

// ============================================================================
// FONTE ÚNICA da identidade deste deploy (marca, clínica, canais, endereço).
//
// Pra CLONAR este CRM pra outro cliente (outra clínica/dentista), troque os
// valores AQUI — não precisa caçar hardcode espalhado pelo código.
//
// Tudo neste arquivo é PÚBLICO (vai pro browser). Nada de segredo aqui:
// chaves/tokens/senhas ficam em variáveis de ambiente (.env.local / Vercel).
//
// URLs respeitam NEXT_PUBLIC_APP_URL (definida no .env) — em dev fica
// http://localhost:3000, em prod o domínio do cliente.
// ============================================================================

const appUrl = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://clinicasakura.org"
).replace(/\/$/, "");

export const CLIENT_CONFIG = {
  // --- Marca / profissional ---
  clinicName: "Clínica Sakura",
  professionalName: "Dra. Juliana Pereira",
  professionalShort: "Dra. Juliana",
  crosp: "130.904",
  tagline: "Odontologia estética em São Paulo",

  // --- PWA / CRM (títulos do app) ---
  crmName: "Sakura CRM",
  crmShort: "Sakura",
  crmHeaderTitle: "CRM Sakura",
  crmDescription:
    "CRM da Clínica Sakura — atendimento WhatsApp + qualificação de leads",

  // --- URLs (derivadas de NEXT_PUBLIC_APP_URL) ---
  appUrl,
  domain: appUrl.replace(/^https?:\/\//, ""),

  // --- Canais públicos ---
  instagramHandle: "drajuliana.pereira",
  instagramUrl: "https://www.instagram.com/drajuliana.pereira/",
  publicWhatsappPhone: "5511962943078", // wa.me do botão público (painel)
  publicWhatsappLabel: "+55 11 96294-3078",

  // --- WhatsApp operacional (roteamento de leads) ---
  // Número usado SÓ quando a tabela wa_numbers está vazia (chips ainda não
  // cadastrados). Em staging, sobrescreva por ambiente com WA_FALLBACK_PHONE
  // (ex.: um número de teste) — ver src/lib/wa-router.ts.
  fallbackWhatsappPhone: "5511982295873",

  // --- Endereço da clínica (ENVIADO ao paciente no WhatsApp) ---
  // TODO Lucas: confirmar com a Ju. Havia DOIS endereços no código:
  //   • Av. Paulista 1159 (playbook — parece o real)
  //   • "Av. Faria Lima, 1234" (chat — placeholder fake, número 1234)
  // Adotado o da Paulista como canônico. Conferir antes de produção.
  address: {
    lines: [
      "Av. Paulista, 1159 — Conj. 803, 8º andar (prédio do Itaú, entrada lateral)",
      "Jardim Paulista, São Paulo - SP · CEP 01311-200",
    ],
    mapsUrl: "https://maps.google.com/?q=Av.+Paulista+1159+Sao+Paulo",
  },
} as const;

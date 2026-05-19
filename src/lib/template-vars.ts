// Interpolação de variáveis em templates de resposta rápida.
// Variáveis suportadas (Sprint 3): {primeiro_nome}.
// Quando uma variável não tem valor, o token fica visível pro atendente preencher.

export type TemplateContext = {
  primeiro_nome?: string | null;
};

const VARS = ["primeiro_nome"] as const;
type VarKey = (typeof VARS)[number];

const RE = new RegExp(`\\{(${VARS.join("|")})\\}`, "g");

export function interpolate(template: string, ctx: TemplateContext): string {
  return template.replace(RE, (_, k: VarKey) => {
    const v = ctx[k];
    if (!v) return `{${k}}`; // mantém token pra atendente notar
    return v;
  });
}

export function firstNameOf(fullName: string | null | undefined): string | null {
  if (!fullName) return null;
  const first = fullName.trim().split(/\s+/)[0];
  return first ? first : null;
}

// "Salvar como template" — detecta o primeiro nome do lead no texto e sugere
// trocar pela variável {primeiro_nome}.
export function replaceNameWithVariable(
  text: string,
  firstName: string | null,
): string {
  if (!firstName) return text;
  // case-insensitive, palavra inteira
  const re = new RegExp(`\\b${escapeRegex(firstName)}\\b`, "gi");
  return text.replace(re, "{primeiro_nome}");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

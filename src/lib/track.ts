"use client";

const SID_KEY = "sakura_qsid";
const UTM_KEY = "sakura_utm";

const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

type UtmData = Partial<Record<(typeof UTM_PARAMS)[number], string>>;

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = sessionStorage.getItem(SID_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(SID_KEY, sid);
  }
  return sid;
}

/**
 * Captura UTMs da URL atual (se houver) e persiste por sessão.
 * Se já tem UTM salvo na sessão e a URL não tem novo, mantém o salvo
 * (evita perder atribuição quando user navega internamente).
 */
export function getUtm(): UtmData {
  if (typeof window === "undefined") return {};
  try {
    const url = new URL(window.location.href);
    const fromUrl: UtmData = {};
    for (const k of UTM_PARAMS) {
      const v = url.searchParams.get(k);
      if (v) fromUrl[k] = v;
    }
    if (Object.keys(fromUrl).length > 0) {
      sessionStorage.setItem(UTM_KEY, JSON.stringify(fromUrl));
      return fromUrl;
    }
    const stored = sessionStorage.getItem(UTM_KEY);
    if (stored) return JSON.parse(stored) as UtmData;
    return {};
  } catch {
    return {};
  }
}

export function trackEvent(
  type:
    | "quiz_pageview"
    | "quiz_step_view"
    | "quiz_wa_click"
    | "quiz_instagram_click",
  payload: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") return;
  const session_id = getSessionId();
  const utm = getUtm();
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, session_id, ...utm, ...payload }),
    keepalive: true,
  }).catch(() => {
    // Fail silently — telemetria não pode quebrar o fluxo
  });
}

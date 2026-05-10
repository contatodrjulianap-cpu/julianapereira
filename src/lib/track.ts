"use client";

const SID_KEY = "sakura_qsid";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = sessionStorage.getItem(SID_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(SID_KEY, sid);
  }
  return sid;
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
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, session_id, ...payload }),
    keepalive: true,
  }).catch(() => {
    // Fail silently — telemetria não pode quebrar o fluxo
  });
}

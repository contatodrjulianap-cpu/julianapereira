import { createServiceClient } from "@/lib/supabase/server";

export type EventLogEntry = {
  /** ex: "fb_capi", "zapi_send", "zapi_webhook", "quiz_submit", "supabase_auth" */
  type: string;
  direction: "inbound" | "outbound" | "internal";
  /** ex: "facebook", "zapi", "supabase", "vercel" */
  target?: string;
  lead_id?: string;
  status: "success" | "failed" | "skipped";
  payload?: unknown;
  response?: unknown;
  error?: string;
  duration_ms?: number;
};

/**
 * Loga evento no Supabase. Fire-and-forget — nunca lança.
 * Tabela `event_log` precisa existir (ver supabase/migrations).
 */
export async function logEvent(entry: EventLogEntry): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("event_log").insert({
      type: entry.type,
      direction: entry.direction,
      target: entry.target ?? null,
      lead_id: entry.lead_id ?? null,
      status: entry.status,
      payload: (entry.payload as Record<string, unknown>) ?? null,
      response: (entry.response as Record<string, unknown>) ?? null,
      error: entry.error ?? null,
      duration_ms: entry.duration_ms ?? null,
    });
    if (error) console.error("event_log insert error:", error.message);
  } catch (e) {
    console.error("logEvent threw:", e);
  }
}

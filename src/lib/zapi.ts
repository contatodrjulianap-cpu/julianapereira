import { logEvent } from "@/lib/event-log";

const BASE = "https://api.z-api.io";

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function endpoint(path: string): string {
  const instance = envOrThrow("ZAPI_INSTANCE_ID");
  const token = envOrThrow("ZAPI_TOKEN");
  return `${BASE}/instances/${instance}/token/${token}${path}`;
}

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "Client-Token": envOrThrow("ZAPI_CLIENT_TOKEN"),
  };
}

export type SendTextInput = {
  phone: string;
  message: string;
  delayMessage?: number;
};

export async function sendText(
  input: SendTextInput,
  meta?: { lead_id?: string },
) {
  const start = Date.now();
  try {
    const res = await fetch(endpoint("/send-text"), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(input),
    });
    const responseJson = await res.json().catch(() => ({}));

    await logEvent({
      type: "zapi_send_text",
      direction: "outbound",
      target: "zapi",
      lead_id: meta?.lead_id,
      status: res.ok ? "success" : "failed",
      payload: input,
      response: responseJson,
      error: res.ok ? undefined : `HTTP ${res.status}`,
      duration_ms: Date.now() - start,
    });

    if (!res.ok) {
      throw new Error(`Z-API send-text failed: ${res.status} ${JSON.stringify(responseJson)}`);
    }
    return responseJson;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    await logEvent({
      type: "zapi_send_text",
      direction: "outbound",
      target: "zapi",
      lead_id: meta?.lead_id,
      status: "failed",
      payload: input,
      error: msg,
      duration_ms: Date.now() - start,
    });
    throw e;
  }
}

export type ZapiWebhookPayload = {
  type?: string;
  instanceId?: string;
  phone?: string;
  fromMe?: boolean;
  isGroup?: boolean;
  participantPhone?: string;
  senderName?: string;
  senderPhoto?: string;
  messageId?: string;
  momment?: number;
  text?: { message?: string };
  image?: { caption?: string; imageUrl?: string };
  audio?: { audioUrl?: string };
  document?: { documentUrl?: string; mimeType?: string };
  [k: string]: unknown;
};

export async function getStatus() {
  const res = await fetch(endpoint("/status"), { headers: headers() });
  return res.json();
}

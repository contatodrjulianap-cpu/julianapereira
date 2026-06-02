import { logEvent } from "@/lib/event-log";

const BASE = "https://api.z-api.io";

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function endpoint(path: string, override?: { instanceId?: string; token?: string }): string {
  const instance = override?.instanceId ?? envOrThrow("ZAPI_INSTANCE_ID");
  const token = override?.token ?? envOrThrow("ZAPI_TOKEN");
  return `${BASE}/instances/${instance}/token/${token}${path}`;
}

function headers(): HeadersInit {
  // Client-Token é account-level (mesmo pra todas as instâncias da mesma conta Z-API).
  // Mantido em env. Se algum dia tiver contas Z-API diferentes, passar override.
  return {
    "Content-Type": "application/json",
    "Client-Token": envOrThrow("ZAPI_CLIENT_TOKEN"),
  };
}

export type SendTextInput = {
  phone: string;
  message: string;
  delayMessage?: number;
  messageId?: string; // referência (reply/quote)
};

export type SendTextMeta = {
  lead_id?: string;
  /** Override de instância (vem de wa_numbers via resolveZapiCredsForLead). */
  instance_id?: string;
  /** Override de token instance-level. */
  token?: string;
};

export async function sendText(input: SendTextInput, meta?: SendTextMeta) {
  const start = Date.now();
  try {
    const res = await fetch(
      endpoint("/send-text", { instanceId: meta?.instance_id, token: meta?.token }),
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(input),
      },
    );
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

export type SendImageInput = {
  phone: string;
  image: string; // URL pública ou base64 data URL
  caption?: string;
};

export async function sendImage(input: SendImageInput, meta?: SendTextMeta) {
  const start = Date.now();
  try {
    const res = await fetch(
      endpoint("/send-image", { instanceId: meta?.instance_id, token: meta?.token }),
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(input),
      },
    );
    const responseJson = await res.json().catch(() => ({}));

    await logEvent({
      type: "zapi_send_image",
      direction: "outbound",
      target: "zapi",
      lead_id: meta?.lead_id,
      status: res.ok ? "success" : "failed",
      payload: { phone: input.phone, caption: input.caption, has_url: !!input.image },
      response: responseJson,
      error: res.ok ? undefined : `HTTP ${res.status}`,
      duration_ms: Date.now() - start,
    });

    if (!res.ok) {
      throw new Error(`Z-API send-image failed: ${res.status} ${JSON.stringify(responseJson)}`);
    }
    return responseJson;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    await logEvent({
      type: "zapi_send_image",
      direction: "outbound",
      target: "zapi",
      lead_id: meta?.lead_id,
      status: "failed",
      payload: { phone: input.phone },
      error: msg,
      duration_ms: Date.now() - start,
    });
    throw e;
  }
}

export type SendAudioInput = {
  phone: string;
  audio: string; // URL pública ou base64 data URL — Z-API converte pra ptt
};

export async function sendAudio(input: SendAudioInput, meta?: SendTextMeta) {
  const start = Date.now();
  try {
    const res = await fetch(
      endpoint("/send-audio", { instanceId: meta?.instance_id, token: meta?.token }),
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(input),
      },
    );
    const responseJson = await res.json().catch(() => ({}));

    await logEvent({
      type: "zapi_send_audio",
      direction: "outbound",
      target: "zapi",
      lead_id: meta?.lead_id,
      status: res.ok ? "success" : "failed",
      payload: { phone: input.phone, has_url: !!input.audio },
      response: responseJson,
      error: res.ok ? undefined : `HTTP ${res.status}`,
      duration_ms: Date.now() - start,
    });

    if (!res.ok) {
      throw new Error(`Z-API send-audio failed: ${res.status} ${JSON.stringify(responseJson)}`);
    }
    return responseJson;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    await logEvent({
      type: "zapi_send_audio",
      direction: "outbound",
      target: "zapi",
      lead_id: meta?.lead_id,
      status: "failed",
      payload: { phone: input.phone },
      error: msg,
      duration_ms: Date.now() - start,
    });
    throw e;
  }
}

export type SendDocumentInput = {
  phone: string;
  document: string; // URL pública ou base64
  fileName?: string;
  caption?: string;
};

export async function sendDocument(
  input: SendDocumentInput,
  extension: string,
  meta?: SendTextMeta,
) {
  const start = Date.now();
  try {
    const res = await fetch(
      endpoint(`/send-document/${extension}`, {
        instanceId: meta?.instance_id,
        token: meta?.token,
      }),
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(input),
      },
    );
    const responseJson = await res.json().catch(() => ({}));

    await logEvent({
      type: "zapi_send_document",
      direction: "outbound",
      target: "zapi",
      lead_id: meta?.lead_id,
      status: res.ok ? "success" : "failed",
      payload: { phone: input.phone, fileName: input.fileName, extension },
      response: responseJson,
      error: res.ok ? undefined : `HTTP ${res.status}`,
      duration_ms: Date.now() - start,
    });

    if (!res.ok) {
      throw new Error(`Z-API send-document failed: ${res.status} ${JSON.stringify(responseJson)}`);
    }
    return responseJson;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    await logEvent({
      type: "zapi_send_document",
      direction: "outbound",
      target: "zapi",
      lead_id: meta?.lead_id,
      status: "failed",
      payload: { phone: input.phone, fileName: input.fileName },
      error: msg,
      duration_ms: Date.now() - start,
    });
    throw e;
  }
}

export type SendContactInput = {
  phone: string;
  contactName: string;
  contactPhone: string;
};

export async function sendContact(input: SendContactInput, meta?: SendTextMeta) {
  const start = Date.now();
  try {
    const res = await fetch(
      endpoint("/send-contact", { instanceId: meta?.instance_id, token: meta?.token }),
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(input),
      },
    );
    const responseJson = await res.json().catch(() => ({}));

    await logEvent({
      type: "zapi_send_contact",
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
      throw new Error(`Z-API send-contact failed: ${res.status} ${JSON.stringify(responseJson)}`);
    }
    return responseJson;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    await logEvent({
      type: "zapi_send_contact",
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
  image?: { caption?: string; imageUrl?: string; mimeType?: string };
  audio?: { audioUrl?: string; mimeType?: string };
  video?: { caption?: string; videoUrl?: string; mimeType?: string };
  document?: { documentUrl?: string; mimeType?: string; fileName?: string };
  sticker?: { stickerUrl?: string };
  contact?: { displayName?: string; vcard?: string };
  location?: { latitude?: number; longitude?: number; address?: string };
  [k: string]: unknown;
};

export async function getStatus() {
  const res = await fetch(endpoint("/status"), { headers: headers() });
  return res.json();
}

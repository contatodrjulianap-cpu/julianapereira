import crypto from "node:crypto";
import { logEvent } from "@/lib/event-log";

const API_VERSION = "v21.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export type CapiUserData = {
  email?: string;
  phone?: string;
  fbp?: string;
  fbc?: string;
  external_id?: string;
  client_ip?: string;
  client_user_agent?: string;
};

export type CapiEvent = {
  // string aberta — config do CRM permite qualquer evento padrão FB.
  // Recomendados: PageView, ViewContent, Lead, AddToCart, InitiateCheckout, Contact, Purchase, Schedule.
  event_name: string;
  event_time?: number;
  event_id?: string;
  event_source_url?: string;
  action_source?:
    | "website"
    | "app"
    | "phone_call"
    | "chat"
    | "email"
    | "physical_store"
    | "system_generated"
    | "other";
  user_data: CapiUserData;
  custom_data?: Record<string, unknown>;
};

function hashUserData(u: CapiUserData) {
  const out: Record<string, string | string[]> = {};
  if (u.email) out.em = sha256(u.email);
  if (u.phone) out.ph = sha256(u.phone);
  if (u.external_id) out.external_id = sha256(u.external_id);
  if (u.fbp) out.fbp = u.fbp;
  if (u.fbc) out.fbc = u.fbc;
  if (u.client_ip) out.client_ip_address = u.client_ip;
  if (u.client_user_agent) out.client_user_agent = u.client_user_agent;
  return out;
}

export async function sendCapiEvent(
  event: CapiEvent,
  meta?: { lead_id?: string },
) {
  const start = Date.now();
  const pixelId = process.env.FB_PIXEL_ID;
  const token = process.env.FB_CONVERSIONS_API_TOKEN;

  if (!pixelId || !token) {
    await logEvent({
      type: "fb_capi",
      direction: "outbound",
      target: "facebook",
      lead_id: meta?.lead_id,
      status: "skipped",
      payload: { event_name: event.event_name },
      error: "FB_PIXEL_ID or FB_CONVERSIONS_API_TOKEN missing",
      duration_ms: Date.now() - start,
    });
    return { skipped: true };
  }

  const body = {
    data: [
      {
        event_name: event.event_name,
        event_time: event.event_time ?? Math.floor(Date.now() / 1000),
        event_id: event.event_id,
        event_source_url: event.event_source_url,
        action_source: event.action_source ?? "website",
        user_data: hashUserData(event.user_data),
        custom_data: event.custom_data,
      },
    ],
  };

  try {
    const res = await fetch(`${GRAPH}/${pixelId}/events?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const responseJson = await res.json().catch(() => ({}));

    await logEvent({
      type: "fb_capi",
      direction: "outbound",
      target: "facebook",
      lead_id: meta?.lead_id,
      status: res.ok ? "success" : "failed",
      payload: body,
      response: responseJson,
      error: res.ok ? undefined : `HTTP ${res.status}`,
      duration_ms: Date.now() - start,
    });

    return responseJson;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    await logEvent({
      type: "fb_capi",
      direction: "outbound",
      target: "facebook",
      lead_id: meta?.lead_id,
      status: "failed",
      payload: body,
      error: msg,
      duration_ms: Date.now() - start,
    });
    throw e;
  }
}

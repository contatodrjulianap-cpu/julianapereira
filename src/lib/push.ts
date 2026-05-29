// Web Push helpers — Movimento A.
// Server-side: envia push pra todas as subscriptions de um user.
// Limpa subs mortas (410 Gone / 404 Not Found) automaticamente.

import webpush, { type PushSubscription as WebPushSub } from "web-push";
import { createServiceClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/event-log";

let configured = false;

function configure() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:contato.drjulianap@gmail.com";
  if (!pub || !priv) throw new Error("VAPID keys ausentes (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)");
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
};

type SubRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Envia push pra TODAS as subscriptions do user. Retorna contagem de
 * (success, failed, pruned). Subs com 404/410 são deletadas do banco.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  context: { lead_id?: string } = {},
): Promise<{ sent: number; failed: number; pruned: number }> {
  configure();
  const supabase = createServiceClient();

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error) {
    await logEvent({
      type: "push_send",
      direction: "outbound",
      target: "webpush",
      lead_id: context.lead_id,
      status: "failed",
      error: error.message,
      payload: { userId },
    });
    return { sent: 0, failed: 0, pruned: 0 };
  }

  if (!subs || subs.length === 0) {
    await logEvent({
      type: "push_send",
      direction: "outbound",
      target: "webpush",
      lead_id: context.lead_id,
      status: "skipped",
      payload: { userId, reason: "no_subscriptions" },
    });
    return { sent: 0, failed: 0, pruned: 0 };
  }

  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const deadIds: string[] = [];

  await Promise.all(
    (subs as SubRow[]).map(async (s) => {
      const subscription: WebPushSub = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      };
      try {
        await webpush.sendNotification(subscription, body, { TTL: 3600 });
        sent++;
        await supabase
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString(), last_error: null })
          .eq("id", s.id);
      } catch (err: unknown) {
        failed++;
        const status = (err as { statusCode?: number })?.statusCode;
        const msg = err instanceof Error ? err.message : String(err);
        if (status === 404 || status === 410) {
          // sub morta — agenda pra deletar
          deadIds.push(s.id);
        } else {
          await supabase
            .from("push_subscriptions")
            .update({ last_error: msg, last_error_at: new Date().toISOString() })
            .eq("id", s.id);
        }
      }
    }),
  );

  let pruned = 0;
  if (deadIds.length > 0) {
    const { error: delErr } = await supabase
      .from("push_subscriptions")
      .delete()
      .in("id", deadIds);
    if (!delErr) pruned = deadIds.length;
  }

  await logEvent({
    type: "push_send",
    direction: "outbound",
    target: "webpush",
    lead_id: context.lead_id,
    status: sent > 0 ? "success" : "failed",
    payload: { userId, title: payload.title, sent, failed, pruned },
  });

  return { sent, failed, pruned };
}

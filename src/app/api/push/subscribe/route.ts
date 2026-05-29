import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/event-log";

const SubBody = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  user_agent: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = SubBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { endpoint, keys, user_agent } = parsed.data;
  const service = createServiceClient();

  // Upsert por endpoint (browser pode re-subscribe e gerar mesmo endpoint).
  // Move pra user atual se endpoint já existia pra outro user (improvável mas seguro).
  const { error } = await service
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: user_agent ?? req.headers.get("user-agent") ?? null,
        last_used_at: new Date().toISOString(),
        last_error: null,
        last_error_at: null,
      },
      { onConflict: "endpoint" },
    );

  if (error) {
    await logEvent({
      type: "push_subscribe",
      direction: "internal",
      target: "supabase",
      status: "failed",
      error: error.message,
      payload: { user_id: user.id },
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logEvent({
    type: "push_subscribe",
    direction: "internal",
    target: "supabase",
    status: "success",
    payload: { user_id: user.id, endpoint_host: new URL(endpoint).host },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  if (!endpoint || typeof endpoint !== "string") {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

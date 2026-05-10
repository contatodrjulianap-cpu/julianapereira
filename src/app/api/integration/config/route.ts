import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  IntegrationConfigSchema,
  getIntegrationConfig,
} from "@/lib/integration-config";
import { logEvent } from "@/lib/event-log";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cfg = await getIntegrationConfig();
  return NextResponse.json(cfg, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = IntegrationConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid config", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const { error } = await service.from("integration_config").upsert({
    id: "current",
    config: parsed.data,
    updated_by: user.email ?? user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logEvent({
    type: "integration_config_update",
    direction: "internal",
    target: "supabase",
    status: "success",
    payload: { updated_by: user.email },
  });

  return NextResponse.json({ ok: true });
}

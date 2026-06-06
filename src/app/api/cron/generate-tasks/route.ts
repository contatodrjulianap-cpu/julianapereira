import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Gera TAREFAS de lembrete de avaliação a partir de leads.scheduled_at.
// NÃO dispara mensagem — só cria a tarefa na fila do atendente (tabela tasks).
// Idempotente: unique(lead_id, kind, due_day) + ignoreDuplicates no upsert.
//
// Rodar algumas vezes/dia (ex: 9h e a cada 1-2h no horário comercial) via:
//   · Vercel cron (vercel.json) chamando esta rota, OU
//   · launchd local: curl -H "x-cron-secret: $CRON_SECRET" .../api/cron/generate-tasks
//
// Auth: header `x-cron-secret` OU `authorization: Bearer <CRON_SECRET>`.

export const dynamic = "force-dynamic";

// Brasil não tem mais horário de verão desde 2019 → America/Sao_Paulo = UTC-3 fixo.
const SP_OFFSET = "-03:00";
const spDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const spTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});

function ymd(d: Date): string {
  return spDateFmt.format(d); // 'YYYY-MM-DD' no fuso SP
}

type LeadRow = {
  id: string;
  name: string | null;
  scheduled_at: string;
  assigned_owner_id: string | null;
  status: string | null;
};

const TERMINAL = new Set(["won", "lost", "disqualified", "attended"]);

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  // GET permitido pra Vercel cron / curl simples.
  return run(req);
}

async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  const headerSecret =
    req.headers.get("x-cron-secret") ??
    (auth?.startsWith("Bearer ") ? auth.slice(7) : null);
  if (headerSecret !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();
  const now = new Date();

  // Limites de dia no fuso SP (instantes UTC).
  const todayYmd = ymd(now);
  const todayStart = new Date(`${todayYmd}T00:00:00${SP_OFFSET}`);
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
  const tomorrowEnd = new Date(tomorrowStart.getTime() + 86_400_000 - 1);
  const tomorrowYmd = ymd(tomorrowStart);
  const soonEnd = new Date(now.getTime() + 4 * 3_600_000); // próximas 4h

  // Lembrete D-1: avaliações de amanhã.
  const { data: d1 } = await db
    .from("leads")
    .select("id, name, scheduled_at, assigned_owner_id, status")
    .gte("scheduled_at", tomorrowStart.toISOString())
    .lte("scheduled_at", tomorrowEnd.toISOString())
    .limit(500);

  // Lembrete do dia: avaliações nas próximas ~4h de hoje.
  const { data: today } = await db
    .from("leads")
    .select("id, name, scheduled_at, assigned_owner_id, status")
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", soonEnd.toISOString())
    .limit(500);

  const rows: Record<string, unknown>[] = [];

  for (const l of (d1 ?? []) as LeadRow[]) {
    if (l.status && TERMINAL.has(l.status)) continue;
    const hora = spTimeFmt.format(new Date(l.scheduled_at));
    rows.push({
      lead_id: l.id,
      kind: "lembrete_avaliacao",
      title: `Lembrar ${l.name ?? "paciente"} — avaliação amanhã ${hora}`,
      // mostra hoje de manhã na fila
      due_at: new Date(todayStart.getTime() + 9 * 3_600_000).toISOString(),
      due_day: todayYmd,
      assigned_owner_id: l.assigned_owner_id,
      source: "auto",
    });
  }

  for (const l of (today ?? []) as LeadRow[]) {
    if (l.status && TERMINAL.has(l.status)) continue;
    const hora = spTimeFmt.format(new Date(l.scheduled_at));
    rows.push({
      lead_id: l.id,
      kind: "lembrete_dia",
      title: `Último lembrete — ${l.name ?? "paciente"} hoje ${hora}`,
      due_at: now.toISOString(),
      due_day: todayYmd,
      assigned_owner_id: l.assigned_owner_id,
      source: "auto",
    });
  }

  let inserted = 0;
  if (rows.length > 0) {
    const { data, error } = await db
      .from("tasks")
      .upsert(rows, { onConflict: "lead_id,kind,due_day", ignoreDuplicates: true })
      .select("id");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    inserted = data?.length ?? 0;
  }

  return NextResponse.json({
    ok: true,
    scanned: { d1: d1?.length ?? 0, today: today?.length ?? 0 },
    candidates: rows.length,
    inserted,
    skipped_existing: rows.length - inserted,
  });
}

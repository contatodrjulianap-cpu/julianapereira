import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { sendCapiEvent } from "@/lib/facebook";

// Espelha o PageView do pixel client (mesmo event_id, mesmos cookies)
// pra CAPI. Resolve cobertura CAPI/PageView que estava em ~14% (só /quiz)
// e a falta de chave de desduplicação.

const Body = z.object({
  event_id: z.string().min(8),
  url: z.string().min(1).optional(),
  referrer: z.string().optional(),
  fbc: z.string().optional(), // cliente já reconstruiu de ?fbclid quando ausente
  external_id: z.string().optional(), // anonId cookie _sak_aid
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const { event_id, url, referrer, fbc: bodyFbc, external_id } = parsed.data;

  // x-forwarded-for preserva o IP de conexão original na Vercel — vem IPv6
  // quando o cliente conectou via IPv6 (resolve nota do relatório).
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    undefined;
  const ua = req.headers.get("user-agent") ?? undefined;
  const fbp = req.cookies.get("_fbp")?.value;
  const fbc = bodyFbc ?? req.cookies.get("_fbc")?.value;

  after(async () => {
    try {
      await sendCapiEvent({
        event_name: "PageView",
        event_id,
        event_source_url: url ?? referrer,
        user_data: {
          external_id,
          fbp,
          fbc,
          client_ip: ip,
          client_user_agent: ua,
        },
      });
    } catch (err) {
      console.error("[track/pageview] CAPI failed", err);
    }
  });

  return NextResponse.json({ ok: true });
}

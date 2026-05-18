import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { routeLeadToWa, normalizePhone } from "@/lib/wa-router";
import { whatsappMessageFor, type Archetype, INSTAGRAM_URL } from "@/lib/quiz-archetypes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Q = z.object({
  archetype: z.enum(["PRONTA", "ESPERANCOSA", "CETICA"]),
  phone: z.string().min(8),
  fn: z.string().default("você"),
});

// GET /api/quiz/wa-link?archetype=PRONTA&phone=5511...&fn=Mariana
// Retorna a URL pronta pro CTA do resultado do quiz.
// - CETICA → Instagram (não passa por WPP)
// - PRONTA/ESPERANCOSA → wa.me/<numero da atendente atribuída>?text=<msg arquétipo>
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = Q.safeParse({
    archetype: url.searchParams.get("archetype"),
    phone: url.searchParams.get("phone"),
    fn: url.searchParams.get("fn") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (parsed.data.archetype === "CETICA") {
    return NextResponse.json({
      url: INSTAGRAM_URL,
      target: "instagram",
      assigned: false,
    });
  }

  const leadPhone = normalizePhone(parsed.data.phone);
  const route = await routeLeadToWa(leadPhone);
  const msg = whatsappMessageFor(parsed.data.archetype as Archetype, parsed.data.fn);
  const waUrl = `https://wa.me/${route.phone}?text=${encodeURIComponent(msg)}`;

  return NextResponse.json({
    url: waUrl,
    target: "whatsapp",
    assigned: !route.fallback,
    fallback: route.fallback ? route.reason : undefined,
  });
}

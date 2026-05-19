import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const PostBody = z.object({
  name: z.string().min(1).max(80),
  phone: z.string().min(8).max(20),
  description: z.string().max(200).nullable().optional(),
  emoji: z.string().max(8).optional(),
  pinned: z.boolean().optional(),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("saved_contacts")
    .select("*")
    .order("pinned", { ascending: false })
    .order("name", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ contacts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = PostBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const digits = parsed.data.phone.replace(/\D/g, "");
  const phone = digits.startsWith("55") ? digits : `55${digits}`;

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("saved_contacts")
    .insert({ ...parsed.data, phone })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ contact: data });
}

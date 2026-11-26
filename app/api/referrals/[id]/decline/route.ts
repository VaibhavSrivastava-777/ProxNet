import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

/** Giver declines. Nothing was charged, so nothing is refunded. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("referral_requests")
    .update({ status: "declined" })
    .eq("id", id)
    .eq("giver_id", user.id)
    .eq("status", "requested")
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "This request is no longer open" }, { status: 409 });
  return NextResponse.json({ ok: true });
}

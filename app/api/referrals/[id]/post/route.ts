import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/referrals";

/** Giver posts the referral link (or code) in the chat. Starts the seeker's confirmation step. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { link } = await request.json().catch(() => ({}));
  const cleanLink = typeof link === "string" ? link.trim() : "";
  if (!cleanLink || cleanLink.length > 500) {
    return NextResponse.json({ error: "Paste the referral link or code (max 500 characters)" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: req } = await supabase
    .from("referral_requests")
    .select("id, seeker_id, giver_id, thread_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!req || req.giver_id !== user.id) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (req.status !== "accepted" || !req.thread_id) {
    return NextResponse.json({ error: "Accept the request before posting a referral" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("referral_requests")
    .update({ status: "referral_posted", referral_link: cleanLink, posted_at: now })
    .eq("id", req.id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  await supabase.from("job_messages").insert({
    thread_id: req.thread_id,
    sender_id: user.id,
    body: `Referral submitted: ${cleanLink}`,
  });

  await notify(
    req.seeker_id,
    "Referral posted",
    "Your referral is ready. Open the chat and confirm once you've received it.",
    `/jobs/chat/${req.thread_id}`
  );

  return NextResponse.json({ ok: true });
}

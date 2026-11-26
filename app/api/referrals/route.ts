import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { REFERRAL_CREDIT_COST, notify } from "@/lib/referrals";

const REQUEST_COLUMNS =
  "id, seeker_id, giver_id, company, status, thread_id, referral_link, created_at, accepted_at, posted_at, completed_at";

/** My requests as seeker, and requests waiting on me as giver. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  const [{ data: me }, { data: asSeeker }, { data: asGiver }] = await Promise.all([
    supabase.from("users").select("wallet").eq("id", user.id).single(),
    supabase
      .from("referral_requests")
      .select(REQUEST_COLUMNS)
      .eq("seeker_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("referral_requests")
      .select(REQUEST_COLUMNS)
      .eq("giver_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const all = [...(asSeeker ?? []), ...(asGiver ?? [])];
  const personIds = Array.from(new Set(all.flatMap((r) => [r.seeker_id, r.giver_id])));
  const { data: people } = personIds.length
    ? await supabase.from("users").select("id, full_name, job_title, company").in("id", personIds)
    : { data: [] as any[] };
  const byId = new Map((people ?? []).map((p) => [p.id, p]));

  const withPeople = (r: any) => ({
    ...r,
    seeker: byId.get(r.seeker_id) ?? null,
    giver: byId.get(r.giver_id) ?? null,
  });

  return NextResponse.json({
    balance: me?.wallet ?? 0,
    creditCost: REFERRAL_CREDIT_COST,
    asSeeker: (asSeeker ?? []).map(withPeople),
    asGiver: (asGiver ?? []).map(withPeople),
  });
}

/** Seeker asks one professional for a referral. No charge until they accept. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { giverId } = await request.json().catch(() => ({}));
  if (!giverId || typeof giverId !== "string") {
    return NextResponse.json({ error: "giverId is required" }, { status: 400 });
  }
  if (giverId === user.id) {
    return NextResponse.json({ error: "You cannot request a referral from yourself" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: me } = await supabase.from("users").select("wallet, full_name").eq("id", user.id).single();
  if ((me?.wallet ?? 0) < REFERRAL_CREDIT_COST) {
    return NextResponse.json(
      { error: `You need ${REFERRAL_CREDIT_COST} credit to request a referral.` },
      { status: 402 }
    );
  }

  const { data: giver } = await supabase
    .from("users")
    .select("id, full_name, company, is_active, is_blocked")
    .eq("id", giverId)
    .maybeSingle();
  if (!giver || !giver.company || !giver.is_active || giver.is_blocked) {
    return NextResponse.json({ error: "This professional is not available" }, { status: 404 });
  }

  const { data: open } = await supabase
    .from("referral_requests")
    .select("id")
    .eq("seeker_id", user.id)
    .eq("giver_id", giverId)
    .in("status", ["requested", "accepted", "referral_posted"])
    .limit(1);
  if (open && open.length > 0) {
    return NextResponse.json({ error: "You already have an open request with this professional" }, { status: 409 });
  }

  const { data: created, error } = await supabase
    .from("referral_requests")
    .insert({ seeker_id: user.id, giver_id: giverId, company: giver.company.trim() })
    .select(REQUEST_COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await notify(
    giverId,
    "Referral request",
    `${me?.full_name || "A professional"} asked for a referral at ${giver.company.trim()}.`,
    "/referrals"
  );

  return NextResponse.json({ request: created });
}

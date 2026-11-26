/**
 * Referral requests: shared helpers.
 *
 * Flow (credits only; Razorpay payments and timers come in a later change):
 *   1. Seeker requests a referral from one professional at a company (no charge).
 *   2. That professional accepts -> seeker is charged 1 credit and a chat opens.
 *   3. Professional posts the referral link in the chat.
 *   4. Seeker confirms receipt -> professional earns 1 credit.
 *   Professional may decline at step 2 (no charge).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";

export const REFERRAL_CREDIT_COST = 1;

export function normalizeCompany(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase();
}

/** Active professionals at a company, excluding one user (usually the seeker). */
export async function getCompanyMembers(company: string, excludeUserId?: string, limit = 200) {
  const supabase = createAdminClient();
  const key = normalizeCompany(company);
  if (!key) return [];

  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, job_title, company, profile_photo_url")
    .eq("is_active", true)
    .eq("is_blocked", false)
    .not("company", "is", null)
    .limit(2000);

  if (error) throw error;

  return (data ?? [])
    .filter((u) => normalizeCompany(u.company) === key && u.id !== excludeUserId)
    .slice(0, limit);
}

/** Company list with headcount and optional logo. */
export async function getCompanyDirectory() {
  const supabase = createAdminClient();

  const { data: users, error } = await supabase
    .from("users")
    .select("company")
    .eq("is_active", true)
    .eq("is_blocked", false)
    .not("company", "is", null)
    .limit(10000);
  if (error) throw error;

  const counts = new Map<string, { name: string; count: number }>();
  for (const u of users ?? []) {
    const key = normalizeCompany(u.company);
    if (!key) continue;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { name: (u.company ?? "").trim(), count: 1 });
  }

  const { data: logos } = await supabase.from("companies").select("name_key, name, logo_url");
  const logoByKey = new Map((logos ?? []).map((c) => [c.name_key as string, c.logo_url as string | null]));

  return Array.from(counts.entries())
    .map(([key, v]) => ({
      key,
      name: v.name,
      count: v.count,
      logoUrl: logoByKey.get(key) ?? null,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Creates the chat thread for an accepted request, reusing the existing jobs chat tables. */
export async function createReferralThread(params: {
  seekerId: string;
  giverId: string;
  company: string;
}): Promise<string> {
  const supabase = createAdminClient();

  const { data: people, error: peopleErr } = await supabase
    .from("users")
    .select("id, full_name, job_title")
    .in("id", [params.seekerId, params.giverId]);
  if (peopleErr) throw peopleErr;

  const seeker = people?.find((p) => p.id === params.seekerId);
  const giver = people?.find((p) => p.id === params.giverId);
  const role = giver?.job_title || "Professional";

  // The jobs chat schema links a thread to two job posts (one per side).
  const { data: giverPost, error: gpErr } = await supabase
    .from("job_posts")
    .insert({
      user_id: params.giverId,
      creator_id: params.giverId,
      type: "giver",
      role,
      company: params.company,
      experience_years: 0,
      skills: "",
      status: "implicit",
      is_public: false,
    })
    .select("id")
    .single();
  if (gpErr) throw gpErr;

  const { data: seekerPost, error: spErr } = await supabase
    .from("job_posts")
    .insert({
      user_id: params.seekerId,
      creator_id: params.seekerId,
      type: "seeker",
      role: seeker?.job_title || "Professional",
      company: params.company,
      experience_years: 0,
      skills: "",
      status: "implicit",
      is_public: false,
    })
    .select("id")
    .single();
  if (spErr) throw spErr;

  const { data: thread, error: threadErr } = await supabase
    .from("job_threads")
    .insert({ post_id: giverPost.id, responder_post_id: seekerPost.id, status: "active" })
    .select("id")
    .single();
  if (threadErr) throw threadErr;

  const { error: partErr } = await supabase.from("job_participants").insert([
    { thread_id: thread.id, user_id: params.giverId, alias: giver?.full_name || "Referrer" },
    { thread_id: thread.id, user_id: params.seekerId, alias: seeker?.full_name || "Candidate" },
  ]);
  if (partErr) throw partErr;

  const { error: msgErr } = await supabase.from("job_messages").insert({
    thread_id: thread.id,
    sender_id: params.giverId,
    body:
      `Hi ${seeker?.full_name || ""}! I accepted your referral request for ${params.company}. ` +
      `Once I've submitted the referral, I'll post the link here. Please confirm when you receive it.`,
  });
  if (msgErr) throw msgErr;

  return thread.id as string;
}

/** Best-effort notification; never throws into the request flow. */
export async function notify(userId: string, title: string, body: string, url: string) {
  try {
    await sendNotification(userId, { title, body, url, data: { type: "referral" } });
  } catch (err) {
    console.error("Referral notification failed:", err);
  }
}

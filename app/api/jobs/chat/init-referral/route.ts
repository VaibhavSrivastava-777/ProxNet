import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contactId, jobId, company, jobTitle } = await request.json();
  if (!contactId || !jobId) return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

  const supabase = createAdminClient();

  const { data: userData } = await supabase.from("users").select("wallet").eq("id", user.id).single();
  const hasLowWallet = !userData || (userData.wallet ?? 0) < 1;

  // 1. Ensure a "target post" exists for the referral so the thread logic works.
  // We'll just create a dummy "giver" post for the contact if we need to.
  const { data: targetUser, error: targetError } = await supabase
    .from("users")
    .select("job_title, company")
    .eq("id", contactId)
    .single();

  if (targetError) {
    console.error("targetError:", targetError);
  }

  if (!targetUser) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const { data: currentUserDb } = await supabase
    .from("users")
    .select("job_title, company")
    .eq("id", user.id)
    .single();

  // Create an implicit seeker post for the current user
  const { data: myPost, error: p1Err } = await supabase
    .from("job_posts")
    .insert({
      user_id: user.id,
      type: "seeker",
      role: currentUserDb?.job_title || "Professional",
      company: currentUserDb?.company || "",
      experience_years: 0,
      skills: "",
      status: "active"
    })
    .select("id")
    .single();

  // Create an implicit giver post for the target user (referral contact)
  const { data: targetPost, error: p2Err } = await supabase
    .from("job_posts")
    .insert({
      user_id: contactId,
      type: "giver",
      role: targetUser.job_title || "Professional",
      company: targetUser.company || company,
      experience_years: 0,
      skills: "",
      status: "active"
    })
    .select("id")
    .single();

  if (p1Err || p2Err) {
    return NextResponse.json({ error: "Failed to implicitly create posts" }, { status: 500 });
  }

  // 3. Create thread
  const { data: thread, error: threadError } = await supabase
    .from("job_threads")
    .insert({
      post_id: targetPost.id,
      responder_post_id: myPost.id,
      status: "active"
    })
    .select("id")
    .single();

  if (threadError) return NextResponse.json({ error: threadError.message }, { status: 500 });

  // 4. Create participants with aliases
  const getAlias = (u: any, defaultPrefix: string) => {
    if (u && u.job_title && u.company) {
      return `${u.job_title} @ ${u.company}`;
    }
    return `${defaultPrefix} ` + Math.random().toString(36).substring(2, 6).toUpperCase();
  };

  const alias1 = getAlias(targetUser, "Referrer");
  const alias2 = getAlias(currentUserDb, "Candidate");

  await supabase.from("job_participants").insert([
    { thread_id: thread.id, user_id: contactId, alias: alias1 },
    { thread_id: thread.id, user_id: user.id, alias: alias2 }
  ]);

  // 5. Insert Automated Initial Message
  const initialMsg = `Hi! I saw your company (${company}) is hiring for the '${jobTitle}' role. I am very interested and would love to learn a bit more about the team culture or role expectations. Do you have a few minutes to chat?`;

  await supabase.from("job_messages").insert({
    thread_id: thread.id,
    sender_id: user.id,
    body: initialMsg
  });

  // Attempt to charge the initiator 1 credit (fails gracefully if insufficient funds)
  await supabase.rpc("charge_session", {
    p_user_id: user.id,
    p_session_id: thread.id,
    amount: 1
  });

  return NextResponse.json({ threadId: thread.id, walletWarning: hasLowWallet });
}

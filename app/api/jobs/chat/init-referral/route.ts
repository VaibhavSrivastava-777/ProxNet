import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contactId, jobId, company, jobTitle, jobUrl, location, score, reason, customMessage } = await request.json();
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
    .select("job_title, company, about, skills")
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
  const isSameCompany = Boolean(
    currentUserDb?.company &&
    targetUser?.company &&
    currentUserDb.company.trim().toLowerCase() === targetUser.company.trim().toLowerCase()
  );

  const getAlias = (u: any, defaultPrefix: string) => {
    if (u && u.job_title && u.company) {
      return `${u.job_title} @ ${u.company}`;
    }
    return `${defaultPrefix} ` + Math.random().toString(36).substring(2, 6).toUpperCase();
  };

  const alias1 = isSameCompany
    ? (targetUser.job_title ? `${targetUser.job_title} @ ${targetUser.company}` : `Colleague @ ${targetUser.company}`)
    : getAlias(targetUser, "Referrer");
  const alias2 = isSameCompany
    ? (currentUserDb?.job_title ? `${currentUserDb.job_title} @ ${currentUserDb?.company}` : `Colleague @ ${currentUserDb?.company}`)
    : getAlias(currentUserDb, "Candidate");

  await supabase.from("job_participants").insert([
    { thread_id: thread.id, user_id: contactId, alias: alias1 },
    { thread_id: thread.id, user_id: user.id, alias: alias2 }
  ]);

  // 5. Insert Automated Initial Message detailing the opportunity and introducing the user
  let initialMsg = customMessage;
  if (!initialMsg) {
    if (isSameCompany) {
      const introLine = `Hi! I noticed we both work at ${targetUser.company || company}.`;
      const oppDetails = [
        `📌 Role: ${jobTitle}`,
        `🏢 Company: ${company}`,
        location ? `📍 Location: ${location}` : null,
        jobUrl ? `🔗 Career Link: ${jobUrl}` : null,
      ].filter(Boolean).join("\n");

      initialMsg = `${introLine}\n\nI came across this internal/open opportunity on ProxNet and would love to connect about it:\n${oppDetails}\n\nCould you share insights about the team or role? Would love to connect!`;
    } else {
      const candidateRole = currentUserDb?.job_title
        ? (currentUserDb?.company ? `${currentUserDb.job_title} at ${currentUserDb.company}` : currentUserDb.job_title)
        : "a fellow professional";
      const introLine = `Hi! I am currently working as ${candidateRole} and interested in exploring opportunities at ${company}.`;
      const oppDetails = [
        `📌 Role: ${jobTitle}`,
        `🏢 Company: ${company}`,
        location ? `📍 Location: ${location}` : null,
        jobUrl ? `🔗 Career Link: ${jobUrl}` : null,
      ].filter(Boolean).join("\n");

      initialMsg = `${introLine}\n\nI came across this opening and would love to be considered for a referral:\n${oppDetails}\n\nCould you please refer my profile or share insights about the role and team? I'd really appreciate your guidance!`;
    }
  }

  await supabase.from("job_messages").insert({
    thread_id: thread.id,
    sender_id: user.id,
    body: initialMsg
  });

  // 6. Notify the Referrer / Colleague in real-time
  try {
    const notifTitle = isSameCompany
      ? `💬 Message from a colleague regarding ${jobTitle}`
      : `🤝 Referral Request: ${jobTitle}`;
    const notifBody = isSameCompany
      ? `${alias2} reached out regarding ${jobTitle} at ${company}. Tap to chat!`
      : `${alias2} asked for a referral for ${jobTitle} at ${company}. Tap to chat!`;

    await sendNotification(contactId, {
      title: notifTitle,
      body: notifBody,
      url: `/jobs/chat/${thread.id}`,
      data: {
        threadId: thread.id,
        type: isSameCompany ? "colleague_message" : "referral_request",
        soundType: "message",
        sound: "default",
        senderAlias: alias2
      }
    });
  } catch (err) {
    console.error("Failed to notify referrer:", err);
  }

  return NextResponse.json({ threadId: thread.id, walletWarning: false });
}

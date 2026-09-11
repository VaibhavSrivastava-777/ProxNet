import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAlias } from "@/lib/anonymize";
import { sendNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any = {};
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const targetUserId = body.targetProfessionalId || body.targetUserId;
  if (!targetUserId) {
    return NextResponse.json({ error: "targetProfessionalId or targetUserId is required" }, { status: 400 });
  }

  if (targetUserId === user.id) {
    return NextResponse.json({ error: "Cannot initiate chat with yourself" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 1. Fetch both target user and current user
  const { data: usersData, error: usersErr } = await supabase
    .from("users")
    .select("id, full_name, job_title, company, home_lat, home_lng, office_lat, office_lng")
    .in("id", [user.id, targetUserId]);

  if (usersErr || !usersData) {
    return NextResponse.json({ error: "Failed to fetch user profiles" }, { status: 500 });
  }

  const currentUser = usersData.find((u) => u.id === user.id);
  const targetUser = usersData.find((u) => u.id === targetUserId);

  if (!targetUser) {
    return NextResponse.json({ error: "Target professional not found" }, { status: 404 });
  }

  // 2. Check if an active direct chat session already exists between the two users
  const { data: mySessions } = await supabase
    .from("chat_participants")
    .select("session_id")
    .eq("user_id", user.id);

  if (mySessions && mySessions.length > 0) {
    const mySessionIds = mySessions.map((s) => s.session_id);
    const { data: sharedSessions } = await supabase
      .from("chat_participants")
      .select("session_id")
      .eq("user_id", targetUserId)
      .in("session_id", mySessionIds);

    if (sharedSessions && sharedSessions.length > 0) {
      return NextResponse.json({ sessionId: sharedSessions[0].session_id, isExisting: true });
    }
  }

  // 3. Determine if they belong to the same company
  const isSameCompany = Boolean(
    currentUser?.company &&
    targetUser?.company &&
    currentUser.company.trim().toLowerCase() === targetUser.company.trim().toLowerCase()
  );

  const initialMessageText = isSameCompany
    ? `Hi! I noticed we both work at ${targetUser.company || currentUser?.company}. Would love to connect and chat!`
    : `Hi! I came across your profile on ProxNet and would love to connect and chat!`;

  // 4. Create a direct question record in questions table
  const centerLat = currentUser?.home_lat ?? currentUser?.office_lat ?? 28.6139;
  const centerLng = currentUser?.home_lng ?? currentUser?.office_lng ?? 77.2090;

  const { data: question, error: qErr } = await supabase
    .from("questions")
    .insert({
      asker_id: user.id,
      body: initialMessageText,
      type: "direct",
      status: "open",
      company_filter: null,
      title_filter: null,
      center_lat: centerLat,
      center_lng: centerLng,
      radius_meters: 5000,
    })
    .select("id, body, created_at")
    .single();

  if (qErr || !question) {
    console.error("Failed to create direct question:", qErr);
    return NextResponse.json({ error: "Failed to create direct question" }, { status: 500 });
  }

  // 5. Register target in question_targets
  await supabase.from("question_targets").insert({
    question_id: question.id,
    professional_id: targetUserId,
    status: "responded",
  });

  // 6. Create chat_session
  const { data: session, error: sErr } = await supabase
    .from("chat_sessions")
    .insert({ question_id: question.id })
    .select("id")
    .single();

  if (sErr || !session) {
    console.error("Failed to create chat session:", sErr);
    return NextResponse.json({ error: "Failed to create chat session" }, { status: 500 });
  }

  // 7. Generate professional aliases
  const getAlias = (u: any, defaultType: "resident" | "professional") => {
    if (u && u.job_title && u.company) return `${u.job_title} @ ${u.company}`;
    return generateAlias(defaultType, 1, u?.company);
  };

  const askerAlias = isSameCompany
    ? (currentUser?.job_title ? `${currentUser.job_title} @ ${currentUser.company}` : `Colleague @ ${currentUser?.company}`)
    : getAlias(currentUser, "resident");

  const proAlias = isSameCompany
    ? (targetUser.job_title ? `${targetUser.job_title} @ ${targetUser.company}` : `Colleague @ ${targetUser.company}`)
    : getAlias(targetUser, "professional");

  await supabase.from("chat_participants").insert([
    { session_id: session.id, user_id: user.id, alias: askerAlias },
    { session_id: session.id, user_id: targetUserId, alias: proAlias },
  ]);

  // 8. Dispatch notification to target user
  try {
    const notifTitle = isSameCompany
      ? `💬 Message from a colleague at ${currentUser?.company || "your company"}`
      : `💬 New message from ${askerAlias}`;

    await sendNotification(targetUserId, {
      title: notifTitle,
      body: initialMessageText,
      url: `/chat/${session.id}`,
      data: {
        sessionId: session.id,
        type: "chat_message",
        soundType: "message",
        sound: "default",
        senderAlias: askerAlias,
      },
    });
  } catch (notifErr) {
    console.warn("Direct chat notification warning:", notifErr);
  }

  return NextResponse.json({ sessionId: session.id, isExisting: false });
}

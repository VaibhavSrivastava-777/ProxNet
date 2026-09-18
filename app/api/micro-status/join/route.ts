import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAlias } from "@/lib/anonymize";
import { sendNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { beaconId, initiatorUserId, activity = "chai", note } = body;

  if (!initiatorUserId) {
    return NextResponse.json({ error: "initiatorUserId is required" }, { status: 400 });
  }

  if (initiatorUserId === user.id) {
    return NextResponse.json({ error: "Cannot join your own broadcast" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 1. Fetch both target user and current user
  const { data: usersData, error: usersErr } = await supabase
    .from("users")
    .select("id, full_name, job_title, company, home_lat, home_lng, office_lat, office_lng")
    .in("id", [user.id, initiatorUserId]);

  if (usersErr || !usersData) {
    return NextResponse.json({ error: "Failed to fetch user profiles" }, { status: 500 });
  }

  const currentUser = usersData.find((u) => u.id === user.id);
  const initiatorUser = usersData.find((u) => u.id === initiatorUserId);

  if (!initiatorUser) {
    return NextResponse.json({ error: "Broadcaster not found" }, { status: 404 });
  }

  const activityLabel =
    activity === "chai"
      ? "15-min Chai"
      : activity === "walk"
      ? "Walk & Talk"
      : activity === "sports"
      ? "Badminton / Sports"
      : "Quick Catch-up";

  const joinMessageText = note
    ? `Hi! I saw your "${activityLabel}" broadcast ("${note}") and would love to join!`
    : `Hi! I saw your "${activityLabel}" broadcast and would love to join!`;

  const senderAlias = currentUser?.job_title && currentUser?.company
    ? `${currentUser.job_title} @ ${currentUser.company}`
    : generateAlias("resident", 1, currentUser?.company);

  const initiatorAlias = initiatorUser.job_title && initiatorUser.company
    ? `${initiatorUser.job_title} @ ${initiatorUser.company}`
    : generateAlias("professional", 1, initiatorUser.company);

  let sessionId: string | null = null;

  // 2. Check if a direct chat session already exists between the two users
  const { data: mySessions } = await supabase
    .from("chat_participants")
    .select("session_id")
    .eq("user_id", user.id);

  if (mySessions && mySessions.length > 0) {
    const mySessionIds = mySessions.map((s) => s.session_id);
    const { data: sharedSessions } = await supabase
      .from("chat_participants")
      .select("session_id")
      .eq("user_id", initiatorUserId)
      .in("session_id", mySessionIds);

    if (sharedSessions && sharedSessions.length > 0) {
      sessionId = sharedSessions[0].session_id;
    }
  }

  // 3. If session does not exist, create question, question_target, chat_session, and chat_participants
  if (!sessionId) {
    const centerLat = currentUser?.home_lat ?? currentUser?.office_lat ?? 12.8871;
    const centerLng = currentUser?.home_lng ?? currentUser?.office_lng ?? 77.5901;

    const { data: question, error: qErr } = await supabase
      .from("questions")
      .insert({
        asker_id: user.id,
        body: joinMessageText,
        type: "direct",
        status: "open",
        company_filter: null,
        title_filter: null,
        center_lat: centerLat,
        center_lng: centerLng,
        radius_meters: 2000,
      })
      .select("id")
      .single();

    if (qErr || !question) {
      console.error("Failed to create direct question for beacon join:", qErr);
      return NextResponse.json({ error: "Failed to initialize conversation" }, { status: 500 });
    }

    await supabase.from("question_targets").insert({
      question_id: question.id,
      professional_id: initiatorUserId,
      status: "pending",
    });

    const { data: session, error: sErr } = await supabase
      .from("chat_sessions")
      .insert({ question_id: question.id })
      .select("id")
      .single();

    if (sErr || !session) {
      console.error("Failed to create chat session for beacon join:", sErr);
      return NextResponse.json({ error: "Failed to create chat session" }, { status: 500 });
    }

    await supabase.from("chat_participants").insert([
      { session_id: session.id, user_id: user.id, alias: senderAlias },
      { session_id: session.id, user_id: initiatorUserId, alias: initiatorAlias },
    ]);

    sessionId = session.id;
  }

  // 4. Automatically create and insert the chat message from User X
  const { error: msgErr } = await supabase.from("chat_messages").insert({
    session_id: sessionId,
    sender_id: user.id,
    body: joinMessageText,
  });

  if (msgErr) {
    console.error("Failed to insert join chat message:", msgErr);
  }

  // 5. Dispatch notification to initiator (FCM token push, or email if token not available)
  try {
    const notifTitle = `☕ ${senderAlias} joined your ${activityLabel} broadcast!`;

    await sendNotification(initiatorUserId, {
      title: notifTitle,
      body: joinMessageText,
      url: `/chat/${sessionId}`,
      data: {
        sessionId,
        type: "beacon_join",
        activity,
        senderAlias,
        soundType: "message",
        sound: "default",
      },
    });
  } catch (notifErr) {
    console.warn("Failed to notify broadcast initiator of join:", notifErr);
  }

  return NextResponse.json({
    success: true,
    sessionId,
    message: joinMessageText,
  });
}

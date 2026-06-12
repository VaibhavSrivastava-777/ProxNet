import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAlias } from "@/lib/anonymize";
import { sendNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { questionId, targetId } = await request.json();
  if (!questionId || !targetId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: target } = await supabase
    .from("question_targets")
    .select("*, questions(asker_id, body)")
    .eq("id", targetId)
    .eq("professional_id", user.id)
    .single();

  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const askerId = target.questions.asker_id;

  const { data: existingSession } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("question_id", questionId)
    .maybeSingle();

  let sessionId = existingSession?.id;

  if (!sessionId) {
    const { data: session, error: sError } = await supabase
      .from("chat_sessions")
      .insert({ question_id: questionId })
      .select("id")
      .single();
    if (sError) return NextResponse.json({ error: sError.message }, { status: 500 });
    sessionId = session.id;

    // Look up companies for both participants to build @Company aliases
    const { data: usersData } = await supabase
      .from("users")
      .select("id, company")
      .in("id", [askerId, user.id]);

    const askerCompany = usersData?.find((u) => u.id === askerId)?.company ?? null;
    const proCompany = usersData?.find((u) => u.id === user.id)?.company ?? null;

    await supabase.from("chat_participants").insert([
      { session_id: sessionId, user_id: askerId, alias: generateAlias("resident", 1, askerCompany) },
      { session_id: sessionId, user_id: user.id, alias: generateAlias("professional", 1, proCompany) },
    ]);
  }

  await supabase
    .from("question_targets")
    .update({ status: "responded" })
    .eq("id", targetId);

  // Notify the asker that a professional responded
  try {
    await sendNotification(askerId, {
      title: "Question Responded",
      body: `A nearby professional responded to your question: "${target.questions.body.slice(0, 60)}${target.questions.body.length > 60 ? "..." : ""}"`,
      url: `/chat/${sessionId}`,
    });
  } catch (err) {
    console.error("Notification trigger error:", err);
  }

  return NextResponse.json({ sessionId });
}

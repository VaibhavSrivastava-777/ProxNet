import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAlias } from "@/lib/anonymize";

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
    .select("*, questions(asker_id)")
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

    await supabase.from("chat_participants").insert([
      { session_id: sessionId, user_id: askerId, alias: generateAlias("resident", 1) },
      { session_id: sessionId, user_id: user.id, alias: generateAlias("professional", 1) },
    ]);
  }

  await supabase
    .from("question_targets")
    .update({ status: "responded" })
    .eq("id", targetId);

  return NextResponse.json({ sessionId });
}

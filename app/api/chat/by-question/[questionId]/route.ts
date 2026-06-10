import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { questionId } = await params;
  const supabase = createAdminClient();

  const { data: session } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("question_id", questionId)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: participant } = await supabase
    .from("chat_participants")
    .select("user_id")
    .eq("session_id", session.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ sessionId: session.id });
}

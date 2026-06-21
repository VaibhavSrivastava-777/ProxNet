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

  let sessionId = session?.id;

  if (!sessionId) {
    // Backward compatibility: If no session exists, check if this is a direct question (exactly 1 target, and asker == user)
    const { data: question } = await supabase
      .from("questions")
      .select("asker_id, type")
      .eq("id", questionId)
      .single();
    
    if (question && question.asker_id === user.id && question.type === "direct") {
      const { data: targets } = await supabase
        .from("question_targets")
        .select("professional_id")
        .eq("question_id", questionId);
      
      if (targets && targets.length === 1) {
        const targetUserId = targets[0].professional_id;
        const { data: newSession } = await supabase.from("chat_sessions").insert({ question_id: questionId }).select("id").single();
        if (newSession) {
          sessionId = newSession.id;
          const { data: usersData } = await supabase.from("users").select("id, company, job_title").in("id", [user.id, targetUserId]);
          const asker = usersData?.find((u: any) => u.id === user.id);
          const pro = usersData?.find((u: any) => u.id === targetUserId);

          const getAlias = (u: any, defaultType: "resident" | "professional") => {
            if (u && u.job_title && u.company) return `${u.job_title} @ ${u.company}`;
            // Simple fallback if generateAlias is not imported
            return defaultType === "resident" ? "A ProxNet User" : "A Nearby Professional";
          };

          await supabase.from("chat_participants").insert([
            { session_id: sessionId, user_id: user.id, alias: getAlias(asker, "resident") },
            { session_id: sessionId, user_id: targetUserId, alias: getAlias(pro, "professional") },
          ]);
        }
      }
    }
  }

  if (!sessionId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: participant } = await supabase
    .from("chat_participants")
    .select("user_id")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ sessionId });
}

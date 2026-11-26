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
    // If no session exists, check if user is asker or targeted professional
    const { data: question } = await supabase
      .from("questions")
      .select("asker_id, type")
      .eq("id", questionId)
      .single();
    
    if (question) {
      const { data: targets } = await supabase
        .from("question_targets")
        .select("professional_id")
        .eq("question_id", questionId);
      
      const isAsker = question.asker_id === user.id;
      const isTarget = targets?.some((t: any) => t.professional_id === user.id);

      if ((isAsker && targets && targets.length === 1) || isTarget) {
        const otherUserId = isAsker ? targets![0].professional_id : question.asker_id;
        const { data: newSession } = await supabase.from("chat_sessions").insert({ question_id: questionId }).select("id").single();
        if (newSession) {
          sessionId = newSession.id;
          const { data: usersData } = await supabase.from("users").select("id, company, job_title").in("id", [user.id, otherUserId]);
          const me = usersData?.find((u: any) => u.id === user.id);
          const other = usersData?.find((u: any) => u.id === otherUserId);

          const getAlias = (u: any, defaultType: "resident" | "professional") => {
            if (u && u.job_title && u.company) return `${u.job_title} @ ${u.company}`;
            return defaultType === "resident" ? "A ProxNet User" : "A Nearby Professional";
          };

          const myAlias = isAsker ? getAlias(me, "resident") : getAlias(me, "professional");
          const otherAlias = isAsker ? getAlias(other, "professional") : getAlias(other, "resident");

          await supabase.from("chat_participants").insert([
            { session_id: sessionId, user_id: user.id, alias: myAlias },
            { session_id: sessionId, user_id: otherUserId, alias: otherAlias },
          ]);

          if (isTarget) {
            await supabase
              .from("question_targets")
              .update({ status: "viewed" })
              .eq("question_id", questionId)
              .eq("professional_id", user.id)
              .eq("status", "pending");
          }
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

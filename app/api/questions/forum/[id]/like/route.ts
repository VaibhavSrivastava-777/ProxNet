import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { commentId, action } = body; // action: 'like' | 'unlike'

  const supabase = createAdminClient();

  if (action === "like") {
    // Insert like
    const insertData: any = { user_id: user.id };
    if (commentId) insertData.comment_id = commentId;
    else insertData.question_id = id;

    const { error: likeErr } = await supabase.from("question_likes").insert(insertData);
    if (!likeErr) {
      if (commentId) {
        await supabase.rpc('increment_comment_likes', { c_id: commentId });
      } else {
        await supabase.rpc('increment_question_likes', { q_id: id });
      }
    }
  } else {
    // Unlike
    let query = supabase.from("question_likes").delete().eq("user_id", user.id);
    if (commentId) query = query.eq("comment_id", commentId);
    else query = query.eq("question_id", id);
    
    const { error: unlikeErr } = await query;
    if (!unlikeErr) {
      if (commentId) {
        await supabase.rpc('decrement_comment_likes', { c_id: commentId });
      } else {
        await supabase.rpc('decrement_question_likes', { q_id: id });
      }
    }
  }

  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  // Fetch the question
  const { data: question, error: qError } = await supabase
    .from("questions")
    .select("*")
    .eq("id", id)
    .single();

  if (qError || !question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  // Fetch comments
  const { data: comments, error: cError } = await supabase
    .from("question_comments")
    .select("*")
    .eq("question_id", id)
    .order("created_at", { ascending: true });

  if (cError) {
    return NextResponse.json({ error: cError.message }, { status: 500 });
  }

  // Fetch my likes for this question and its comments
  const { data: myLikes } = await supabase
    .from("question_likes")
    .select("*")
    .eq("user_id", user.id);

  const likedQuestion = myLikes?.some(l => l.question_id === id && !l.comment_id) || false;
  const likedComments = new Set(myLikes?.filter(l => l.comment_id).map(l => l.comment_id));

  return NextResponse.json({
    question: {
      ...question,
      asker_alias: `Neighbor-${question.asker_id.slice(0, 4)}`,
      has_liked: likedQuestion
    },
    comments: (comments ?? []).map(c => ({
      ...c,
      has_liked: likedComments.has(c.id)
    }))
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { text, parentId } = body;

  if (!text?.trim()) {
    return NextResponse.json({ error: "Comment text is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const alias = `Neighbor-${user.id.slice(0, 4)}`;

  const { data: comment, error } = await supabase
    .from("question_comments")
    .insert({
      question_id: id,
      user_id: user.id,
      alias,
      body: text.trim(),
      parent_id: parentId || null
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ comment: { ...comment, has_liked: false } });
}

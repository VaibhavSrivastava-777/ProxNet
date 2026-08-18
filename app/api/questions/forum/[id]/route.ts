import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUsersWithin2km } from "@/lib/notifications";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  // Fetch the question
  const { data: question, error: qError } = await supabase
    .from("questions")
    .select("*, users(full_name, anonymous_name, job_title, company, profile_photo_url)")
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

  const u = question.users as any;
  const isAnon = question.is_anonymous !== false;

  return NextResponse.json({
    isAdmin: user.source === "admin",
    question: {
      ...question,
      is_anonymous: isAnon,
      is_edited: question.is_edited ?? false,
      asker_name: isAnon ? (u?.anonymous_name || `Neighbor-${question.asker_id.slice(0, 4)}`) : (u?.full_name || u?.anonymous_name || "Neighbor"),
      asker_alias: isAnon ? (u?.anonymous_name || `Neighbor-${question.asker_id.slice(0, 4)}`) : (u?.full_name || u?.anonymous_name || "Neighbor"),
      asker_title: isAnon ? null : u?.job_title,
      asker_company: isAnon ? null : u?.company,
      asker_photo: isAnon ? null : u?.profile_photo_url,
      has_liked: likedQuestion
    },
    comments: (comments ?? []).map(c => ({
      ...c,
      has_liked: likedComments.has(c.id)
    }))
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const body = await request.json();
  const { questionText, questionBody, isAnonymous } = body;

  const qText = (questionBody || questionText || "").trim();
  if (!qText) {
    return NextResponse.json({ error: "Post content cannot be empty" }, { status: 400 });
  }

  const { data: existing } = await supabase.from("questions").select("asker_id").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (existing.asker_id !== user.id && user.source !== "admin") {
    return NextResponse.json({ error: "Forbidden: You can only edit your own posts" }, { status: 403 });
  }

  let { data: updated, error } = await supabase
    .from("questions")
    .update({
      body: qText,
      is_anonymous: isAnonymous ?? true,
      is_edited: true,
    })
    .eq("id", id)
    .select()
    .single();

  if (error && (error.message.includes("is_edited") || error.code === "PGRST204" || error.code === "42703")) {
    const retry = await supabase
      .from("questions")
      .update({
        body: qText,
        is_anonymous: isAnonymous ?? true,
      })
      .eq("id", id)
      .select()
      .single();

    updated = retry.data;
    error = retry.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (updated) {
    const cLat = Number(updated.center_lat || user.home_lat || user.office_lat || 28.6139);
    const cLng = Number(updated.center_lng || user.home_lng || user.office_lng || 77.2090);
    notifyUsersWithin2km({
      creatorId: user.id,
      centerLat: cLat,
      centerLng: cLng,
      title: "Updated Forum Post nearby",
      body: qText.length > 80 ? `${qText.slice(0, 80)}...` : qText,
      url: `/qa/forum/${updated.id}`,
      data: { questionId: updated.id, isEdit: true }
    }).catch(err => console.error("2km notification error for edited post:", err));
  }

  return NextResponse.json({ question: updated });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  const { data: existing } = await supabase.from("questions").select("asker_id").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  if (existing.asker_id !== user.id && user.source !== "admin") {
    return NextResponse.json({ error: "Forbidden: You can only delete your own posts" }, { status: 403 });
  }

  const { error } = await supabase
    .from("questions")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
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

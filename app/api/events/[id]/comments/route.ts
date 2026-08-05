import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: comments, error } = await supabase
    .from("event_comments")
    .select(`
      id,
      event_id,
      user_id,
      body,
      created_at,
      user:users (
        id,
        full_name,
        avatar_url,
        company,
        job_title
      )
    `)
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ comments: comments || [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bodyData = await request.json();
  const { body } = bodyData;

  if (!body || !body.trim()) {
    return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: newComment, error } = await supabase
    .from("event_comments")
    .insert({
      event_id: id,
      user_id: user.id,
      body: body.trim(),
    })
    .select(`
      id,
      event_id,
      user_id,
      body,
      created_at,
      user:users (
        id,
        full_name,
        avatar_url,
        company,
        job_title
      )
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ comment: newComment });
}

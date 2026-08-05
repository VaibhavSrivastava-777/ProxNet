import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const supabase = createAdminClient();

  const { data: jobPost, error } = await supabase
    .from("job_posts")
    .select(`
      *,
      creator:users!job_posts_user_id_fkey(id, full_name, job_title, company, profile_photo_url),
      interests:job_post_interests(
        status,
        user:users(id, full_name, job_title, company, profile_photo_url)
      ),
      likes:job_post_likes(id, user_id),
      comments:job_post_comments(id)
    `)
    .eq("id", id)
    .single();

  if (error || !jobPost) {
    return NextResponse.json({ error: "Job post not found" }, { status: 404 });
  }

  const creatorId = jobPost.creator_id || jobPost.user_id;

  let userInterest = null;
  if (user) {
    const found = (jobPost.interests || []).find((i: any) => i.user?.id === user.id);
    if (found) userInterest = found.status;
  }

  return NextResponse.json({
    jobPost,
    userInterest,
    isCreator: user ? user.id === creatorId : false
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const supabase = createAdminClient();

  const { data: jobPost } = await supabase.from("job_posts").select("creator_id, user_id").eq("id", id).single();
  if (!jobPost) return NextResponse.json({ error: "Job post not found" }, { status: 404 });

  const creatorId = jobPost.creator_id || jobPost.user_id;
  if (creatorId !== user.id && user.source !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { data: updatedPost, error } = await supabase
    .from("job_posts")
    .update({
      type: body.type,
      role: body.role,
      company: body.company,
      experience_years: body.experienceYears,
      skills: body.skills,
      description: body.description,
      contact_info: body.contactInfo,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobPost: updatedPost });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  const { data: jobPost, error: fetchError } = await supabase
    .from("job_posts")
    .select("creator_id, user_id")
    .eq("id", id)
    .single();

  if (fetchError || !jobPost) {
    return NextResponse.json({ error: "Job post not found" }, { status: 404 });
  }

  const creatorId = jobPost.creator_id || jobPost.user_id;
  if (creatorId !== user.id && user.source !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Delete child records first to avoid foreign key constraints
  await supabase.from("job_post_interests").delete().eq("job_post_id", id);
  await supabase.from("job_post_invites").delete().eq("job_post_id", id);

  const { error: deleteError } = await supabase.from("job_posts").delete().eq("id", id);
  if (deleteError) {
    console.error("Error deleting job post:", deleteError);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

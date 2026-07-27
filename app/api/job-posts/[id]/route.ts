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
      creator:users!job_posts_creator_id_fkey(id, full_name, job_title, company, profile_photo_url),
      interests:job_post_interests(
        status,
        user:users(id, full_name, job_title, company, profile_photo_url)
      )
    `)
    .eq("id", id)
    .single();

  if (error || !jobPost) {
    return NextResponse.json({ error: "Job post not found" }, { status: 404 });
  }

  let userInterest = null;
  if (user) {
    const found = (jobPost.interests || []).find((i: any) => i.user?.id === user.id);
    if (found) userInterest = found.status;
  }

  return NextResponse.json({
    jobPost,
    userInterest,
    isCreator: user ? user.id === jobPost.creator_id : false
  });
}

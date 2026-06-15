import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { type, role, company, experience_years, skills } = body;

  if (!type || !role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Expire existing active post of the same type
  await supabase
    .from("job_posts")
    .update({ status: "matched" })
    .eq("user_id", user.id)
    .eq("type", type)
    .eq("status", "active");

  const { data, error } = await supabase
    .from("job_posts")
    .insert({
      user_id: user.id,
      type,
      role,
      company: company || null,
      experience_years: parseInt(experience_years) || 0,
      skills: skills || null,
      status: "active"
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing post ID" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("job_posts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // Ensure user owns the post

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

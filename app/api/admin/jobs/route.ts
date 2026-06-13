import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const admin = await getCurrentUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // In a real app, verify admin role here. Assuming we are in admin section.

  const body = await request.json();
  const { user_id, type, role, company, experience_years, skills } = body;

  if (!user_id || !role || !type) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("job_posts")
    .insert({
      user_id,
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

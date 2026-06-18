import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { type, role, company, experience_years, skills, is_on_behalf, contact_number } = body;

  if (!type || !role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createAdminClient();


  const { data, error } = await supabase
    .from("job_posts")
    .insert({
      user_id: user.id,
      type,
      role,
      company: company || null,
      experience_years: parseInt(experience_years) || 0,
      skills: skills || null,
      status: "active",
      is_on_behalf: is_on_behalf || false,
      contact_number: contact_number || null
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, type, role, company, experience_years, skills, is_on_behalf, contact_number } = body;

  if (!id || !type || !role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("job_posts")
    .update({
      type,
      role,
      company: company || null,
      experience_years: parseInt(experience_years) || 0,
      skills: skills || null,
      is_on_behalf: is_on_behalf || false,
      contact_number: contact_number || null
    })
    .eq("id", id)
    .eq("user_id", user.id) // Ensure user owns the post
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

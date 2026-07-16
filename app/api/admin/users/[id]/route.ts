import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeLinkedInUrl } from "@/lib/linkedin/normalize-url";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) return null;
  return session;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("users").select("*").eq("id", id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const supabase = createAdminClient();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const fields = [
    "full_name",
    "email",
    "company",
    "job_title",
    "profile_photo_url",
    "home_lat",
    "home_lng",
    "office_lat",
    "office_lng",
    "active_location",
    "is_active",
  ] as const;

  for (const f of fields) {
    if (body[f] !== undefined) updates[f] = body[f];
  }
  if (body.linkedin_profile_url !== undefined) {
    updates.linkedin_profile_url = normalizeLinkedInUrl(body.linkedin_profile_url);
  }

  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  try {
    // Purge dependencies in sequence to satisfy foreign key constraints
    await supabase.from("fcm_tokens").delete().eq("user_id", id);
    await supabase.from("user_follows").delete().or(`follower_id.eq.${id},following_id.eq.${id}`);
    await supabase.from("referral_relationships").delete().or(`inviter_id.eq.${id},invitee_id.eq.${id}`);
    await supabase.from("points_log").delete().eq("user_id", id);
    await supabase.from("in_app_notifications").delete().eq("user_id", id);
    await supabase.from("question_likes").delete().eq("user_id", id);
    await supabase.from("question_comments").delete().eq("user_id", id);
    await supabase.from("chat_messages").delete().eq("sender_id", id);
    await supabase.from("chat_participants").delete().eq("user_id", id);
    await supabase.from("question_targets").delete().eq("professional_id", id);
    await supabase.from("questions").delete().eq("asker_id", id);
    await supabase.from("carpool_posts").delete().eq("user_id", id);
    await supabase.from("job_posts").delete().eq("user_id", id);
    await supabase.from("user_current_locations").delete().eq("user_id", id);

    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Admin user delete failed:", error);
    return NextResponse.json({ error: error.message || "Deletion failed" }, { status: 500 });
  }
}

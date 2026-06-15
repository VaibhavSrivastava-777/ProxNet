import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { type, start_name, start_lat, start_lng, dest_name, dest_lat, dest_lng, date, time_start, time_end, seats, is_recurring, recurring_days } = body;

  if (!type || !start_lat || !start_lng || !dest_lat || !dest_lng || !time_start || !time_end || !seats) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  
  if (!is_recurring && !date) {
    return NextResponse.json({ error: "Missing date for one-time trip" }, { status: 400 });
  }

  if (type !== "giver" && type !== "seeker") {
    return NextResponse.json({ error: "Invalid post type" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Expire any existing active posts for this user (only one active post allowed)
  await supabase
    .from("carpool_posts")
    .update({ status: "expired" })
    .eq("user_id", user.id)
    .eq("status", "active");

  // Insert the new post
  const { data, error } = await supabase
    .from("carpool_posts")
    .insert({
      user_id: user.id,
      type,
      status: "active",
      start_name,
      start_lat,
      start_lng,
      dest_name,
      dest_lat,
      dest_lng,
      date,
      is_recurring: is_recurring || false,
      recurring_days: is_recurring ? recurring_days : null,
      time_start,
      time_end,
      seats,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating carpool post:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
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
    .from("carpool_posts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // Ensure user owns the post

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

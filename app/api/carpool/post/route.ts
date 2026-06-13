import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { type, start_lat, start_lng, dest_lat, dest_lng, date, time_start, time_end, seats } = body;

  if (!type || !start_lat || !start_lng || !dest_lat || !dest_lng || !date || !time_start || !time_end || !seats) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (type !== "giver" && type !== "seeker") {
    return NextResponse.json({ error: "Invalid post type" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Expire any existing active posts of the same type for this user
  await supabase
    .from("carpool_posts")
    .update({ status: "expired" })
    .eq("user_id", user.id)
    .eq("type", type)
    .eq("status", "active");

  // Insert the new post
  const { data, error } = await supabase
    .from("carpool_posts")
    .insert({
      user_id: user.id,
      type,
      status: "active",
      start_lat,
      start_lng,
      dest_lat,
      dest_lng,
      date,
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

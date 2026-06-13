import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const admin = await getCurrentUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { user_id, type, seats, start_lat, start_lng, dest_lat, dest_lng, date, time_start, time_end } = body;

  if (!user_id || !type || !seats || !start_lat || !start_lng || !dest_lat || !dest_lng || !date || !time_start || !time_end) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("carpool_posts")
    .insert({
      user_id,
      type,
      start_lat: parseFloat(start_lat),
      start_lng: parseFloat(start_lng),
      dest_lat: parseFloat(dest_lat),
      dest_lng: parseFloat(dest_lng),
      date,
      time_start,
      time_end,
      seats: parseInt(seats) || 1,
      status: "active"
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}

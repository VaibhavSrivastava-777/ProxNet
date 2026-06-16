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

export async function GET() {
  const admin = await getCurrentUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("carpool_posts")
    .select("*, user:users(full_name, email)")
    .in("status", ["active", "matched"])
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data });
}

export async function PATCH(request: Request) {
  const admin = await getCurrentUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, type, seats, start_name, dest_name, date, time_start, time_end, is_recurring, status } = body;

  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("carpool_posts")
    .update({
      type,
      seats: parseInt(seats) || 1,
      start_name,
      dest_name,
      date,
      time_start,
      time_end,
      is_recurring: !!is_recurring,
      status: status || "active"
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const admin = await getCurrentUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("carpool_posts").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

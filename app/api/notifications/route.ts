import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

// Fetch the user's latest 30 notifications
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("in_app_notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("Failed to fetch notifications:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ notifications: data || [] });
}

// Mark a notification (or all) as read
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { id, ids, url } = await request.json();

  let query = supabase.from("in_app_notifications").update({ is_read: true }).eq("user_id", user.id);

  if (id) {
    query = query.eq("id", id);
  } else if (ids && Array.isArray(ids)) {
    query = query.in("id", ids);
  } else if (url) {
    query = query.eq("url", url);
  }

  const { error } = await query;

  if (error) {
    console.error("Failed to mark notifications as read:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

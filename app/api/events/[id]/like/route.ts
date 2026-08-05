import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  // Check if user already liked this event
  const { data: existing } = await supabase
    .from("event_likes")
    .select("id")
    .eq("event_id", id)
    .eq("user_id", user.id)
    .is("comment_id", null)
    .maybeSingle();

  if (existing) {
    // Delete like (Unlike)
    await supabase.from("event_likes").delete().eq("id", existing.id);
    return NextResponse.json({ liked: false });
  } else {
    // Add like
    await supabase.from("event_likes").insert({
      event_id: id,
      user_id: user.id,
    });
    return NextResponse.json({ liked: true });
  }
}

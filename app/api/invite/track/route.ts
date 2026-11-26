import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/invite/track
 * Logs a share event when the user taps a share button.
 * Body: { channel: "whatsapp" | "sms" | "linkedin" | "copy" | "contacts" }
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const channel = body.channel;

  if (!channel || typeof channel !== "string") {
    return NextResponse.json({ error: "Missing channel" }, { status: 400 });
  }

  const inviteCode = user.invite_code;
  if (!inviteCode) {
    return NextResponse.json({ error: "No invite code" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase.from("invite_events").insert({
    inviter_id: user.id,
    channel,
    invite_code: inviteCode,
    clicked: false,
    signed_up: false,
  });

  if (error) {
    console.error("Failed to track invite event:", error);
    return NextResponse.json({ error: "Failed to track" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

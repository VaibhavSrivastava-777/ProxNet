import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!code || code.length < 3) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const supabase = createAdminClient();

  // Validate invite code exists
  const { data: inviter } = await supabase
    .from("users")
    .select("id, invite_code")
    .eq("invite_code", code)
    .maybeSingle();

  if (!inviter) {
    // Invalid code — just redirect to landing page
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Set the referral cookie (30-day expiry)
  const cookieStore = await cookies();
  cookieStore.set("proxnet_ref", code, {
    httpOnly: true,
    secure: false, // Allow HTTP local testing, staging, and emulator routing
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  // Increment click count on invite_events (insert a new click event)
  await supabase.from("invite_events").insert({
    inviter_id: inviter.id,
    channel: "link",
    invite_code: code,
    clicked: true,
    signed_up: false,
  });

  // Redirect to the main landing page with a ref flag for the toast
  return NextResponse.redirect(new URL("/?ref=invite", request.url));
}

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

interface JoinPageProps {
  params: Promise<{ code: string }>;
}

/**
 * Invite landing page: /join/[code]
 * 
 * 1. Validates the invite code
 * 2. Sets a proxnet_ref cookie for post-signup attribution
 * 3. Increments click tracking
 * 4. Redirects to the main landing page
 */
export default async function JoinPage({ params }: JoinPageProps) {
  const { code } = await params;

  if (!code || code.length < 3) {
    redirect("/");
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
    redirect("/");
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
  redirect("/?ref=invite");
}

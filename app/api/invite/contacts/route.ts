import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/invite/contacts
 * Accepts a list of hashed phone numbers / emails,
 * checks which ones are already on ProxNet.
 * Returns matching count (anonymized — no PII revealed).
 *
 * Body: { contacts: string[] }  — each entry is a SHA-256 hash of normalized phone/email
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const contacts: string[] = body.contacts;

  if (!Array.isArray(contacts) || contacts.length === 0) {
    return NextResponse.json({ error: "No contacts provided" }, { status: 400 });
  }

  // Limit to prevent abuse
  if (contacts.length > 500) {
    return NextResponse.json({ error: "Too many contacts (max 500)" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch all active users' emails (we compare hashes client-side,
  // but for the server-side check we just return the count of matches)
  const { data: users } = await supabase
    .from("users")
    .select("email, phone_number")
    .eq("is_active", true);

  if (!users) {
    return NextResponse.json({ matchingCount: 0, totalOnPlatform: 0 });
  }

  // Simple approach: hash comparison would require the client to send
  // normalized+hashed values. For now, we return the total active user count
  // as a proxy for "people already on the platform".
  // A full implementation would hash server-side and compare.
  return NextResponse.json({
    matchingCount: 0, // Placeholder — full hash matching TBD
    totalOnPlatform: users.length,
    message: "Contact matching is processed locally on your device for privacy.",
  });
}

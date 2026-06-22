import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();

  // Check if AI user exists
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", "ai@proxnet.in")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ success: true, id: existing.id, message: "AI User already exists" });
  }

  // Create AI user
  const { data: newUser, error } = await supabase
    .from("users")
    .insert({
      email: "ai@proxnet.in",
      full_name: "ProxNet AI",
      job_title: "Network Assistant",
      company: "ProxNet",
      source: "admin",
      is_active: true,
      visibility: { showCompany: true, showTitle: true, showPhoto: true }
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: newUser.id, message: "AI User created" });
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeLinkedInUrl } from "@/lib/linkedin/normalize-url";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(user);
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const supabase = createAdminClient();

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.full_name !== undefined) updates.full_name = body.full_name;
  if (body.company !== undefined) updates.company = body.company;
  if (body.job_title !== undefined) updates.job_title = body.job_title;
  if (body.profile_photo_url !== undefined) updates.profile_photo_url = body.profile_photo_url;
  if (body.linkedin_profile_url !== undefined) {
    updates.linkedin_profile_url = normalizeLinkedInUrl(body.linkedin_profile_url);
  }
  if (body.home_name !== undefined) updates.home_name = body.home_name;
  if (body.home_lat !== undefined) updates.home_lat = body.home_lat;
  if (body.home_lng !== undefined) updates.home_lng = body.home_lng;
  if (body.office_name !== undefined) updates.office_name = body.office_name;
  if (body.office_lat !== undefined) updates.office_lat = body.office_lat;
  if (body.office_lng !== undefined) updates.office_lng = body.office_lng;
  if (body.active_location !== undefined) updates.active_location = body.active_location;
  if (body.visibility !== undefined) updates.visibility = body.visibility;

  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", user.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

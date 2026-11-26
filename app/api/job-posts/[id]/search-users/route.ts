import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() || "";

  if (q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const supabase = createAdminClient();

  const { data: users, error } = await supabase
    .from("users")
    .select("id, full_name, job_title, company, profile_photo_url")
    .or(`full_name.ilike.%${q}%,company.ilike.%${q}%,job_title.ilike.%${q}%`)
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users });
}

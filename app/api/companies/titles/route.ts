import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const company = searchParams.get("company");

  if (!company) {
    return NextResponse.json({ titles: [] });
  }

  const supabase = createAdminClient();
  const { data: users, error } = await supabase
    .from("users")
    .select("job_title")
    .eq("is_active", true)
    .ilike("company", company)
    .not("job_title", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const uniqueTitlesMap = new Map<string, string>();
  for (const d of (users ?? [])) {
    if (!d.job_title) continue;
    const trimmed = d.job_title.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!uniqueTitlesMap.has(lower)) {
      uniqueTitlesMap.set(lower, trimmed);
    } else {
      const existing = uniqueTitlesMap.get(lower)!;
      if (existing === existing.toLowerCase() && trimmed !== trimmed.toLowerCase()) {
        uniqueTitlesMap.set(lower, trimmed);
      }
    }
  }
  const titles = Array.from(uniqueTitlesMap.values()).sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ titles });
}

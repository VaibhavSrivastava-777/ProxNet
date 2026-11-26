import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TOP_DESIGNATIONS, searchDesignations } from "@/lib/data/curated-suggestions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const company = searchParams.get("company");
  const q = searchParams.get("q");

  const supabase = createAdminClient();
  let query = supabase
    .from("users")
    .select("job_title")
    .eq("is_active", true)
    .not("job_title", "is", null);

  if (company) {
    query = query.ilike("company", company);
  }

  const { data: users, error } = await query;

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
  const dbTitles = Array.from(uniqueTitlesMap.values());

  if (q && q.trim()) {
    const matched = searchDesignations(q.trim(), dbTitles, 10);
    return NextResponse.json({ titles: matched });
  }

  // If no query and company provided, return company titles
  if (company && dbTitles.length > 0) {
    return NextResponse.json({ titles: dbTitles.sort((a, b) => a.localeCompare(b)) });
  }

  // Otherwise return merged DB titles + curated designations
  const allMap = new Map<string, string>();
  for (const t of dbTitles) {
    allMap.set(t.toLowerCase(), t);
  }
  for (const t of TOP_DESIGNATIONS) {
    if (!allMap.has(t.toLowerCase())) {
      allMap.set(t.toLowerCase(), t);
    }
  }

  const titles = Array.from(allMap.values()).sort((a, b) => a.localeCompare(b));
  return NextResponse.json({ titles });
}

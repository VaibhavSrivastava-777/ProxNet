import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeLinkedInUrl } from "@/lib/linkedin/normalize-url";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) return null;
  return session;
}

export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const start = (page - 1) * limit;
  const end = start + limit - 1;

  const supabase = createAdminClient();
  let query = supabase.from("users").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(start, end);

  if (q) {
    query = query.or(
      `full_name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`
    );
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data ?? [], total: count ?? 0, page, limit });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("users")
    .insert({
      full_name: body.full_name,
      email: body.email ?? null,
      company: body.company ?? null,
      job_title: body.job_title ?? null,
      profile_photo_url: body.profile_photo_url ?? null,
      linkedin_profile_url: normalizeLinkedInUrl(body.linkedin_profile_url),
      source: "admin",
      home_lat: body.home_lat ?? null,
      home_lng: body.home_lng ?? null,
      office_lat: body.office_lat ?? null,
      office_lng: body.office_lng ?? null,
      active_location: body.active_location ?? "home",
      is_active: body.is_active ?? true,
      is_blocked: body.is_blocked ?? false,
      about: body.about ?? null,
      professional_bio: body.professional_bio ?? null,
      wallet: body.wallet ?? 0,
      tags: body.tags ?? [],
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

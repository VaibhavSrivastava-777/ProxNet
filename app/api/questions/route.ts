import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { haversineDistanceMeters } from "@/lib/geo/haversine";
import { resolveUserLocation } from "@/lib/anonymize";
import type { User } from "@/lib/types";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  const { data: asked } = await supabase
    .from("questions")
    .select("*, question_targets(status)")
    .eq("asker_id", user.id)
    .order("created_at", { ascending: false });

  const { data: targeted } = await supabase
    .from("question_targets")
    .select("*, questions(*)")
    .eq("professional_id", user.id)
    .order("id", { ascending: false });

  const incoming = (targeted ?? []).map((t) => ({
    id: t.questions.id,
    body: t.questions.body,
    status: t.status,
    company_filter: t.questions.company_filter,
    title_filter: t.questions.title_filter,
    created_at: t.questions.created_at,
    asker_alias: `Resident-${t.questions.asker_id.slice(0, 4)}`,
    target_id: t.id,
  }));

  return NextResponse.json({ asked: asked ?? [], incoming });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    questionBody,
    companyFilter,
    titleFilter,
    centerLat,
    centerLng,
    radiusMeters,
  } = body;

  if (!questionBody?.trim()) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: question, error: qError } = await supabase
    .from("questions")
    .insert({
      asker_id: user.id,
      body: questionBody.trim(),
      company_filter: companyFilter || null,
      title_filter: titleFilter || null,
      center_lat: centerLat,
      center_lng: centerLng,
      radius_meters: radiusMeters ?? 100,
    })
    .select("*")
    .single();

  if (qError) return NextResponse.json({ error: qError.message }, { status: 500 });

  const { data: users } = await supabase.from("users").select("*").eq("is_active", true).neq("id", user.id);
  const { data: currentLocations } = await supabase.from("user_current_locations").select("*");
  const locationMap = new Map(
    (currentLocations ?? []).map((l) => [l.user_id, { lat: Number(l.lat), lng: Number(l.lng) }])
  );

  const targets: { question_id: string; professional_id: string }[] = [];

  for (const u of (users ?? []) as User[]) {
    if (companyFilter && u.company?.toLowerCase() !== companyFilter.toLowerCase()) continue;
    if (titleFilter && !u.job_title?.toLowerCase().includes(titleFilter.toLowerCase())) continue;

    const current = locationMap.get(u.id);
    const loc = resolveUserLocation(u, current?.lat, current?.lng);
    if (!loc) continue;

    const distance = haversineDistanceMeters(centerLat, centerLng, loc.lat, loc.lng);
    if (distance <= (radiusMeters ?? 100)) {
      targets.push({ question_id: question.id, professional_id: u.id });
    }
  }

  if (targets.length > 0) {
    await supabase.from("question_targets").insert(targets);
  }

  return NextResponse.json({ question, targetCount: targets.length });
}

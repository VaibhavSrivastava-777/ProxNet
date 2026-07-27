import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const lat = parseFloat(url.searchParams.get("lat") || "0");
  const lng = parseFloat(url.searchParams.get("lng") || "0");
  const radius = parseInt(url.searchParams.get("radius") || "2000", 10);

  if (!lat || !lng) {
    return NextResponse.json({ error: "Missing location parameters" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: jobPosts, error } = await supabase
    .from("job_posts")
    .select(`
      *,
      creator:users!job_posts_user_id_fkey(full_name, job_title, company, profile_photo_url),
      interests:job_post_interests(user_id, status)
    `)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter by distance (haversine)
  const toRad = (value: number) => (value * Math.PI) / 180;
  const calcDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const filteredJobs = (jobPosts || []).filter((j: any) => {
    if (!j.center_lat || !j.center_lng) return true;
    const dist = calcDistance(lat, lng, j.center_lat, j.center_lng);
    j.distance = dist;
    return dist <= radius;
  });

  return NextResponse.json({ jobPosts: filteredJobs });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { type, role, company, experienceYears, skills, description, contactInfo, centerLat, centerLng, isPublic } = body;

  if (!type || !role || !centerLat || !centerLng) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Check credit balance
  const { data: userData } = await supabase.from("users").select("wallet").eq("id", user.id).single();
  const currentWallet = userData?.wallet ?? 0;

  if (currentWallet < 1) {
    return NextResponse.json({ error: "Insufficient credits. You need at least 1 credit to create a Job Post." }, { status: 402 });
  }

  const { data: jobPost, error } = await supabase
    .from("job_posts")
    .insert({
      user_id: user.id,
      creator_id: user.id,
      type,
      role,
      company: company || null,
      experience_years: experienceYears || null,
      skills: skills || null,
      description: description || null,
      contact_info: contactInfo || null,
      center_lat: centerLat,
      center_lng: centerLng,
      is_public: isPublic ?? true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Deduct 1 credit point
  await supabase.from("users").update({ wallet: Math.max(0, currentWallet - 1) }).eq("id", user.id);

  // Auto add creator as interested
  await supabase.from("job_post_interests").insert({
    job_post_id: jobPost.id,
    user_id: user.id,
    status: "interested"
  });

  return NextResponse.json({ jobPost });
}

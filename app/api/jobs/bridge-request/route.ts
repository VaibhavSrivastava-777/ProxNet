import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const company = searchParams.get("company")?.trim();

  const supabase = createAdminClient();

  // 1. Fetch user's existing bridge requests
  const { data: userData } = await supabase
    .from("users")
    .select("profile_digest")
    .eq("id", user.id)
    .single();

  const bridgeRequests = userData?.profile_digest?.bridge_requests || [];

  // 2. Search for alumni or connected members who may know this company
  let potentialAlumni: Array<{ id: string; name: string; title: string; company: string }> = [];
  if (company) {
    const { data: alumniData } = await supabase
      .from("users")
      .select("id, full_name, first_name, last_name, job_title, company, about")
      .or(`company.ilike.%${company}%,about.ilike.%${company}%`)
      .neq("id", user.id)
      .limit(5);

    if (alumniData) {
      potentialAlumni = alumniData.map((u) => ({
        id: u.id,
        name: u.first_name ? `${u.first_name} ${u.last_name?.[0] || ""}.` : u.full_name || "Network Peer",
        title: u.job_title || "Verified Member",
        company: u.company || company,
      }));
    }
  }

  return NextResponse.json({
    bridgeRequests,
    potentialAlumni,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { company, jobTitle, note } = await request.json();
  if (!company) {
    return NextResponse.json({ error: "Company is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch current user's profile digest
  const { data: userData, error } = await supabase
    .from("users")
    .select("profile_digest")
    .eq("id", user.id)
    .single();

  if (error || !userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const currentDigest = userData.profile_digest || {};
  const bridgeRequests = currentDigest.bridge_requests || [];

  const newRequest = {
    id: `bridge_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    company,
    jobTitle: jobTitle || "Target Role",
    note: note || `Looking for an insider connection or insights at ${company}.`,
    created_at: new Date().toISOString(),
    status: "active",
  };

  const updatedRequests = [newRequest, ...bridgeRequests.filter((r: { company: string }) => r.company !== company)];

  await supabase
    .from("users")
    .update({
      profile_digest: {
        ...currentDigest,
        bridge_requests: updatedRequests,
      },
    })
    .eq("id", user.id);

  return NextResponse.json({
    success: true,
    bridgeRequest: newRequest,
    allRequests: updatedRequests,
  });
}

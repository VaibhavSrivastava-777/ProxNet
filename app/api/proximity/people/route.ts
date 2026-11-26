import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { haversineDistanceMeters } from "@/lib/geo/haversine";
import type { User, UserVisibility } from "@/lib/types";
import { calculateProfileMatchScore } from "@/lib/matching/profile-similarity";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  const radius = parseInt(searchParams.get("radius") ?? "5000", 10);
  const unfiltered = searchParams.get("unfiltered") === "true";
  const tagFilter = searchParams.get("tag")?.trim().toLowerCase() || null;
  const targetId = searchParams.get("targetId")?.trim() || null;

  let effectiveLat = lat;
  let effectiveLng = lng;
  let effectiveUnfiltered = unfiltered;

  if (Number.isNaN(effectiveLat) || Number.isNaN(effectiveLng)) {
    if (user.home_lat != null && user.home_lng != null) {
      effectiveLat = Number(user.home_lat);
      effectiveLng = Number(user.home_lng);
    } else {
      effectiveLat = 12.9716;
      effectiveLng = 77.5946;
      effectiveUnfiltered = true;
    }
  }

  const supabase = createAdminClient();

  // Fetch current user's full profile and embedding for cosine similarity matching
  const { data: currentUserData } = await supabase
    .from("users")
    .select("id, embedding, job_title, company, about, professional_bio, tags, profile_digest, institute_name:user_institute_affiliations(institute:institutes(name, short_code))")
    .eq("id", user.id)
    .maybeSingle();

  const rawInst = (currentUserData as any)?.institute_name;
  let currentInstituteName: string | null = null;
  if (typeof rawInst === "string") {
    currentInstituteName = rawInst;
  } else if (Array.isArray(rawInst) && rawInst.length > 0) {
    currentInstituteName = rawInst[0]?.institute?.short_code || rawInst[0]?.institute?.name || null;
  } else if (rawInst && typeof rawInst === "object") {
    currentInstituteName = (rawInst as any).institute?.short_code || (rawInst as any).institute?.name || null;
  }

  const currentProfile = {
    ...user,
    ...(currentUserData || {}),
    institute_name: currentInstituteName,
  };

  // Fetch all active users with profile fields and embeddings for cosine similarity
  // Note: scrapbook attributes (ask_me_about, help_offers, etc.) live inside profile_digest
  const { data: users, error: errUsers } = await supabase
    .from("users")
    .select("id, email, full_name, company, job_title, about, professional_bio, tags, profile_digest, resume_text, home_lat, home_lng, office_lat, office_lng, active_location, profile_photo_url, anonymous_name, visibility, embedding")
    .eq("is_active", true)
    .neq("id", user.id)
    .neq("id", "a2a05c8b-5a70-4212-990e-276b91219a24")
    .neq("email", "ai@proxnet.in")
    .not("company", "ilike", "proxnet")
    .not("full_name", "ilike", "%proxnet ai%");

  if (errUsers) return NextResponse.json({ error: errUsers.message }, { status: 500 });

  // Fetch user locations
  const { data: currentLocations } = await supabase.from("user_current_locations").select("*");
  const locationMap = new Map(
    (currentLocations ?? []).map((l) => [l.user_id, { lat: Number(l.lat), lng: Number(l.lng) }])
  );

  // Fetch following list
  const { data: following } = await supabase
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", user.id);
  
  const followingIds = new Set((following ?? []).map((f) => f.following_id));

  // Fetch affiliations for all users
  const { data: affiliations } = await supabase
    .from("user_institute_affiliations")
    .select("user_id, institute:institutes(name, short_code)");

  const affiliationMap = new Map<string, string>();
  for (const aff of (affiliations ?? []) as any[]) {
    if (aff.user_id && aff.institute?.name && !affiliationMap.has(aff.user_id)) {
      affiliationMap.set(aff.user_id, aff.institute.short_code || aff.institute.name);
    }
  }

function isBotOrAiUser(u: any): boolean {
  if (!u) return false;
  const id = (u.id || "").toLowerCase();
  const email = (u.email || "").toLowerCase();
  const fullName = (u.full_name || "").toLowerCase();
  const anonName = (u.anonymous_name || "").toLowerCase();
  const comp = (u.company || "").toLowerCase();
  const title = (u.job_title || "").toLowerCase();
  return (
    id === "a2a05c8b-5a70-4212-990e-276b91219a24" ||
    email === "ai@proxnet.in" ||
    email === "ai@proxnet.com" ||
    email.startsWith("ai@") ||
    fullName.includes("proxnet ai") ||
    fullName === "proxnet" ||
    anonName.includes("proxnet ai") ||
    comp === "proxnet" ||
    title.includes("network assistant")
  );
}

  const nearbyPeople: any[] = [];

  for (const u of (users ?? []) as any[]) {
    // Exclude ProxNet AI / system bots from peer network directory
    if (isBotOrAiUser(u)) continue;

    // If user has no job title or company, don't show in proximity list
    if (!u.job_title?.trim() || !u.company?.trim()) continue;

    // Filter by tag if requested
    if (tagFilter) {
      const cleanFilter = tagFilter.replace(/^#+/, "").trim().toLowerCase();
      if (cleanFilter) {
        if (
          !u.tags ||
          !u.tags.some((t: string) => {
            const cleanT = String(t).replace(/^#+/, "").trim().toLowerCase();
            return cleanT.includes(cleanFilter) || cleanFilter.includes(cleanT);
          })
        ) {
          continue;
        }
      }
    }

    const current = locationMap.get(u.id);
    let minDistance = Infinity;

    const locsToCheck = [];
    if (u.home_lat != null && u.home_lng != null) locsToCheck.push({ lat: Number(u.home_lat), lng: Number(u.home_lng) });
    if (u.office_lat != null && u.office_lng != null) locsToCheck.push({ lat: Number(u.office_lat), lng: Number(u.office_lng) });
    if (current?.lat != null && current?.lng != null) locsToCheck.push({ lat: current.lat, lng: current.lng });

    for (const loc of locsToCheck) {
      const distance = haversineDistanceMeters(effectiveLat, effectiveLng, loc.lat, loc.lng);
      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    if (effectiveUnfiltered || minDistance <= radius || (targetId && u.id === targetId)) {
      const digest = (u as any).profile_digest || {};
      const personInst = affiliationMap.get(u.id) ?? null;
      const personHelpOffers = (Array.isArray(u.help_offers) && u.help_offers.length > 0) ? u.help_offers : (digest.help_offers || []);
      const personTinkeringWith = (Array.isArray(u.tinkering_with) && u.tinkering_with.length > 0) ? u.tinkering_with : (digest.tinkering_with || []);
      const personAskMeAbout = (Array.isArray(u.ask_me_about) && u.ask_me_about.length > 0) ? u.ask_me_about : (digest.ask_me_about || []);
      const personQuickChat = u.quick_chat_preference || digest.quick_chat_preference || null;
      const personSocietyName = u.society_name || digest.society_name || null;

      const personForMatching = {
        ...u,
        institute_name: personInst,
        help_offers: personHelpOffers,
        tinkering_with: personTinkeringWith,
        ask_me_about: personAskMeAbout,
        quick_chat_preference: personQuickChat,
        society_name: personSocietyName,
      };

      const { score: matchScore, similarity } = calculateProfileMatchScore(currentProfile, personForMatching);

      nearbyPeople.push({
        id: u.id,
        full_name: u.full_name || null,
        anonymous_name: u.anonymous_name || `Neighbour-${u.id.slice(0, 4)}`,
        job_title: u.job_title.trim(),
        company: u.company.trim(),
        about: (u as any).about || null,
        professional_bio: (u as any).professional_bio || null,
        tags: u.tags || [],
        profile_digest: digest || (u as any).profile_digest || null,
        resume_text: (u as any).resume_text ? (u as any).resume_text.slice(0, 1500) : null,
        help_offers: (Array.isArray(u.help_offers) && u.help_offers.length > 0) ? u.help_offers : (digest.help_offers || []),
        tinkering_with: (Array.isArray(u.tinkering_with) && u.tinkering_with.length > 0) ? u.tinkering_with : (digest.tinkering_with || []),
        ask_me_about: (Array.isArray(u.ask_me_about) && u.ask_me_about.length > 0) ? u.ask_me_about : (digest.ask_me_about || []),
        quick_chat_preference: personQuickChat,
        society_name: personSocietyName,
        visibility: u.visibility,
        profile_photo_url: u.visibility?.showPhoto ? u.profile_photo_url : null,
        distance: minDistance === Infinity ? null : minDistance,
        is_followed: followingIds.has(u.id),
        institute_name: personInst,
        similarity: Number(similarity.toFixed(4)),
        match_score: matchScore,
      });
    }
  }

  // If strict radius (e.g. 2km) yielded 0 people for users in a new or developing neighborhood,
  // auto-expand so NO user is greeted with a blank screen!
  let autoExpanded = false;
  if (!effectiveUnfiltered && nearbyPeople.length === 0) {
    autoExpanded = true;
    for (const u of (users ?? []) as any[]) {
      // Exclude ProxNet AI / system bots from peer network directory
      if (isBotOrAiUser(u)) continue;

      const title = (u.job_title || "").trim();
      const comp = (u.company || "").trim();
      if ((!title || title === "null") && (!comp || comp === "null")) continue;

      const current = locationMap.get(u.id);
      let minDistance = Infinity;

      const locsToCheck = [];
      if (u.home_lat != null && u.home_lng != null) locsToCheck.push({ lat: Number(u.home_lat), lng: Number(u.home_lng) });
      if (u.office_lat != null && u.office_lng != null) locsToCheck.push({ lat: Number(u.office_lat), lng: Number(u.office_lng) });
      if (current?.lat != null && current?.lng != null) locsToCheck.push({ lat: current.lat, lng: current.lng });

      for (const loc of locsToCheck) {
        const distance = haversineDistanceMeters(effectiveLat, effectiveLng, loc.lat, loc.lng);
        if (distance < minDistance) {
          minDistance = distance;
        }
      }

      const digest = (u as any).profile_digest || {};
      const personInst = affiliationMap.get(u.id) ?? null;
      const personHelpOffers = (Array.isArray(u.help_offers) && u.help_offers.length > 0) ? u.help_offers : (digest.help_offers || []);
      const personTinkeringWith = (Array.isArray(u.tinkering_with) && u.tinkering_with.length > 0) ? u.tinkering_with : (digest.tinkering_with || []);
      const personAskMeAbout = (Array.isArray(u.ask_me_about) && u.ask_me_about.length > 0) ? u.ask_me_about : (digest.ask_me_about || []);
      const personQuickChat = u.quick_chat_preference || digest.quick_chat_preference || null;
      const personSocietyName = u.society_name || digest.society_name || null;

      const personForMatching = {
        ...u,
        job_title: title && title !== "null" ? title : "Professional",
        company: comp && comp !== "null" ? comp : "Nearby Company",
        institute_name: personInst,
        help_offers: personHelpOffers,
        tinkering_with: personTinkeringWith,
        ask_me_about: personAskMeAbout,
        quick_chat_preference: personQuickChat,
        society_name: personSocietyName,
      };

      const { score: matchScore, similarity } = calculateProfileMatchScore(currentProfile, personForMatching);

      nearbyPeople.push({
        id: u.id,
        full_name: u.full_name || null,
        anonymous_name: u.anonymous_name || `Neighbour-${u.id.slice(0, 4)}`,
        job_title: title && title !== "null" ? title : "Professional",
        company: comp && comp !== "null" ? comp : "Nearby Company",
        about: (u as any).about || null,
        professional_bio: (u as any).professional_bio || null,
        tags: u.tags || [],
        profile_digest: digest || (u as any).profile_digest || null,
        resume_text: (u as any).resume_text ? (u as any).resume_text.slice(0, 1500) : null,
        help_offers: (Array.isArray(u.help_offers) && u.help_offers.length > 0) ? u.help_offers : (digest.help_offers || []),
        tinkering_with: (Array.isArray(u.tinkering_with) && u.tinkering_with.length > 0) ? u.tinkering_with : (digest.tinkering_with || []),
        ask_me_about: (Array.isArray(u.ask_me_about) && u.ask_me_about.length > 0) ? u.ask_me_about : (digest.ask_me_about || []),
        quick_chat_preference: personQuickChat,
        society_name: personSocietyName,
        visibility: u.visibility,
        profile_photo_url: u.visibility?.showPhoto ? u.profile_photo_url : null,
        distance: minDistance === Infinity ? null : minDistance,
        is_followed: followingIds.has(u.id),
        institute_name: personInst,
        similarity: Number(similarity.toFixed(4)),
        match_score: matchScore,
      });
    }
  }

  // Sort by likelihood of profile match (cosine similarity descending), then by distance ascending
  nearbyPeople.sort((a, b) => {
    if (b.match_score !== a.match_score) {
      return b.match_score - a.match_score;
    }
    const distA = a.distance === null ? Infinity : a.distance;
    const distB = b.distance === null ? Infinity : b.distance;
    if (distA !== distB) {
      return distA - distB;
    }
    return a.company.localeCompare(b.company);
  });

  if (targetId) {
    const targetPerson = nearbyPeople.find((p) => p.id === targetId);
    if (targetPerson) {
      return NextResponse.json({ person: targetPerson, people: nearbyPeople, autoExpanded });
    }
  }

  return NextResponse.json({ people: nearbyPeople, autoExpanded });
}

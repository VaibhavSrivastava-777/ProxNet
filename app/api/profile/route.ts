import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { normalizeLinkedInUrl } from "@/lib/linkedin/normalize-url";

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`, {
      headers: {
        "User-Agent": "ProxNet/1.0"
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.address) return null;
    
    const addr = data.address;
    const parts = [
      addr.neighbourhood,
      addr.suburb,
      addr.road,
      addr.residential,
      addr.city_district,
      addr.city || addr.town
    ].filter(Boolean);
    
    if (parts.length > 0) {
      return parts.slice(0, 2).join(", ");
    }
    return data.display_name || null;
  } catch (e) {
    console.error("Reverse geocoding failed", e);
    return null;
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(user);
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  if (!isSupabaseConfigured()) {
    const mockUser = {
      ...user,
      ...body,
      id: user.id,
      linkedin_sub: user.linkedin_sub,
      email: user.email,
      source: user.source,
      created_at: user.created_at,
      updated_at: new Date().toISOString(),
    };
    return NextResponse.json(mockUser);
  }
  const supabase = createAdminClient();

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.full_name !== undefined) updates.full_name = body.full_name;
  if (body.company !== undefined) updates.company = body.company;
  if (body.job_title !== undefined) updates.job_title = body.job_title;
  if (body.about !== undefined) updates.about = body.about;
  if (body.professional_bio !== undefined) updates.professional_bio = body.professional_bio;
  if (body.resume_url !== undefined) updates.resume_url = body.resume_url;
  if (body.resume_text !== undefined) updates.resume_text = body.resume_text;
  if (body.profile_photo_url !== undefined) updates.profile_photo_url = body.profile_photo_url;
  if (body.linkedin_profile_url !== undefined) {
    updates.linkedin_profile_url = normalizeLinkedInUrl(body.linkedin_profile_url);
  }
  const { data: currentUser } = await supabase.from("users").select("*").eq("id", user.id).single();

  const homeLat = body.home_lat !== undefined ? body.home_lat : currentUser?.home_lat;
  const homeLng = body.home_lng !== undefined ? body.home_lng : currentUser?.home_lng;
  const hasHomeCoordChanged = (body.home_lat !== undefined && Number(body.home_lat) !== Number(currentUser?.home_lat)) ||
                              (body.home_lng !== undefined && Number(body.home_lng) !== Number(currentUser?.home_lng));

  if (body.home_name !== undefined && body.home_name !== null) {
    updates.home_name = body.home_name;
  } else if (hasHomeCoordChanged && homeLat && homeLng) {
    const name = await reverseGeocode(Number(homeLat), Number(homeLng));
    if (name) {
      updates.home_name = name;
    }
  }
  if (body.home_lat !== undefined) updates.home_lat = body.home_lat;
  if (body.home_lng !== undefined) updates.home_lng = body.home_lng;

  const officeLat = body.office_lat !== undefined ? body.office_lat : currentUser?.office_lat;
  const officeLng = body.office_lng !== undefined ? body.office_lng : currentUser?.office_lng;
  const hasOfficeCoordChanged = (body.office_lat !== undefined && Number(body.office_lat) !== Number(currentUser?.office_lat)) ||
                                (body.office_lng !== undefined && Number(body.office_lng) !== Number(currentUser?.office_lng));

  if (body.office_name !== undefined && body.office_name !== null) {
    updates.office_name = body.office_name;
  } else if (hasOfficeCoordChanged && officeLat && officeLng) {
    const name = await reverseGeocode(Number(officeLat), Number(officeLng));
    if (name) {
      updates.office_name = name;
    }
  }
  if (body.office_lat !== undefined) updates.office_lat = body.office_lat;
  if (body.office_lng !== undefined) updates.office_lng = body.office_lng;

  if (body.active_location !== undefined) updates.active_location = body.active_location;
  if (body.visibility !== undefined) updates.visibility = body.visibility;

  if (body.anonymous_name !== undefined) {
    const cleanName = body.anonymous_name?.trim();
    if (!cleanName) {
      return NextResponse.json({ error: "Anonymous name cannot be blank." }, { status: 400 });
    }
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .ilike("anonymous_name", cleanName)
      .neq("id", user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "This anonymous name is already taken. Please choose another one." }, { status: 400 });
    }
    updates.anonymous_name = cleanName;
  }

  if (body.company !== undefined || body.job_title !== undefined || body.about !== undefined || body.resume_text !== undefined) {
    const finalCompany = body.company !== undefined ? body.company : currentUser?.company;
    const finalTitle = body.job_title !== undefined ? body.job_title : currentUser?.job_title;
    const finalAbout = body.about !== undefined ? body.about : currentUser?.about;
    const finalResume = body.resume_text !== undefined ? body.resume_text : currentUser?.resume_text;
    
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (OPENAI_KEY) {
      const denseContext = finalResume ? `Resume: ${finalResume}` : `About: ${finalAbout || "None"}`;
      const textToEmbed = `Company: ${finalCompany || "None"}\nRole: ${finalTitle || "None"}\n${denseContext}`.slice(0, 8000);
      try {
        const oaiRes = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            input: textToEmbed,
            model: "text-embedding-3-small"
          })
        });
        if (oaiRes.ok) {
          const oaiData = await oaiRes.json();
          if (oaiData.data?.[0]?.embedding) {
            updates.embedding = oaiData.data[0].embedding;
          }
        }
      } catch (e) {
        console.error("Failed to generate user embedding", e);
      }
    }
  }

  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", user.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

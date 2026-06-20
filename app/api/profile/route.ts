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
  if (body.about !== undefined) updates.about = body.about;
  if (body.resume_url !== undefined) updates.resume_url = body.resume_url;
  if (body.resume_text !== undefined) updates.resume_text = body.resume_text;
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

  const { data: currentUser } = await supabase.from("users").select("*").eq("id", user.id).single();

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

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // 1. Fetch current user's profile to get role, company, and about
    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("job_title, company, about")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: "Failed to fetch user profile" }, { status: 500 });
    }

    // 2. Generate embedding for the user's profile
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
      return NextResponse.json({ error: "OpenAI API Key not configured" }, { status: 500 });
    }

    // Embed the designation (job_title), company, and about
    const textToEmbed = `Company: ${userProfile.company || "None"}\nRole: ${userProfile.job_title || "None"}\nAbout: ${userProfile.about || "None"}`.slice(0, 8000);

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

    if (!oaiRes.ok) {
      return NextResponse.json({ error: "Failed to generate embedding" }, { status: 500 });
    }

    const oaiData = await oaiRes.json();
    const userEmbedding = oaiData.data[0].embedding;

    // 3. Match against jobs using the Supabase RPC function
    // This RPC handles the 7-day filter and ProxNet company inner join
    const { data: matchedJobs, error: matchError } = await supabase.rpc("match_scraped_jobs", {
      query_embedding: userEmbedding,
      match_threshold: 0.2, // Lower threshold to allow broader matches, tune as needed
      match_count: 10
    });

    if (matchError) {
      console.error("Match RPC Error:", matchError);
      return NextResponse.json({ error: "Failed to match jobs" }, { status: 500 });
    }

    // The RPC returns multiple rows if there are multiple ProxNet users at the same company.
    // We want to group them so each job has an array of referral contacts.
    const jobMap = new Map();

    for (const row of matchedJobs || []) {
      if (!jobMap.has(row.id)) {
        jobMap.set(row.id, {
          id: row.id,
          company: row.company,
          title: row.title,
          location: row.location,
          url: row.url,
          description: row.description,
          posted_at: row.posted_at,
          similarity: row.similarity,
          referralContacts: []
        });
      }

      // Avoid suggesting the current user as their own referral contact
      if (row.contact_id !== user.id) {
        // Add unique contacts
        const jobEntry = jobMap.get(row.id);
        if (!jobEntry.referralContacts.find((c: any) => c.id === row.contact_id)) {
          jobEntry.referralContacts.push({
            id: row.contact_id,
            alias: row.contact_alias
          });
        }
      }
    }

    // Filter out jobs that don't have any valid referral contacts (e.g. if the user was the only employee)
    const finalJobs = Array.from(jobMap.values()).filter(j => j.referralContacts.length > 0);

    return NextResponse.json({ jobs: finalJobs });

  } catch (error) {
    console.error("Suggested jobs error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

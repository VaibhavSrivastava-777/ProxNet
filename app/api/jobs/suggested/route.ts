import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

function isJuniorJob(title: string, description: string): boolean {
  const t = title.toLowerCase();
  const d = description.toLowerCase();

  const seniorKeywords = ["senior", "sr.", "sr ", "lead", "principal", "staff", "director", "manager", "architect", "head", "vp", "chief"];
  const isExplicitlySenior = seniorKeywords.some(kw => t.includes(kw));
  if (isExplicitlySenior) {
    return false;
  }

  const juniorTitles = ["junior", "jr.", "jr ", "intern", "trainee", "fresher", "entry-level", "entry level"];
  if (juniorTitles.some(kw => t.includes(kw))) {
    return true;
  }

  const expRegexes = [
    /(\d+)\s*(?:-|to)\s*(\d+)\s*years?/gi,
    /(\d+)\+?\s*years?\s+(?:of\s+)?experience/gi,
    /experience\s+(?:of\s+)?(\d+)\+?\s*years?/gi,
    /min(?:imum)?\s*(\d+)\s*years?/gi
  ];

  for (const regex of expRegexes) {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(d)) !== null) {
      const val1 = parseInt(match[1], 10);
      const val2 = match[2] ? parseInt(match[2], 10) : null;
      if (!isNaN(val1)) {
        if (val2 !== null) {
          if (val2 < 3) {
            return true;
          }
        } else {
          if (val1 < 3) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("job_title, company, about, resume_text, embedding, profile_digest")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: "Failed to fetch user profile" }, { status: 500 });
    }

    let profileDigest = userProfile.profile_digest;
    const OPENAI_KEY = process.env.OPENAI_API_KEY;

    // 1. Generate profile_digest if missing
    if (!profileDigest && OPENAI_KEY) {
      try {
        console.log(`Generating profile digest for user ${user.id}...`);
        const denseContext = userProfile.resume_text ? `Resume: ${userProfile.resume_text}` : `About: ${userProfile.about || "None"}`;
        const prompt = `Create a short JSON profile digest for a professional candidate based on their details:
Job Title: ${userProfile.job_title || "Unknown"}
Company: ${userProfile.company || "Unknown"}
Details: ${denseContext.substring(0, 4000)}

Return ONLY a JSON object with:
{
  "skills": ["skill1", "skill2"],
  "summary": "1-sentence professional summary",
  "experienceYears": 5
}`;

        const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
          })
        });

        if (oaiRes.ok) {
          const oaiData = await oaiRes.json();
          profileDigest = JSON.parse(oaiData.choices[0].message.content);
          
          // Save profile_digest to DB
          await supabase
            .from("users")
            .update({ profile_digest: profileDigest })
            .eq("id", user.id);
          console.log("Profile digest saved successfully.");
        }
      } catch (digestErr: any) {
        console.error("Error generating profile digest:", digestErr.message);
      }
    }

    let userEmbedding = userProfile.embedding;

    // 2. Generate embedding on-the-fly if not saved yet
    if (!userEmbedding && OPENAI_KEY) {
      const denseContext = userProfile.resume_text ? `Resume: ${userProfile.resume_text}` : `About: ${userProfile.about || "None"}`;
      const textToEmbed = `Company: ${userProfile.company || "None"}\nRole: ${userProfile.job_title || "None"}\n${denseContext}`.slice(0, 8000);

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
        userEmbedding = oaiData.data[0].embedding;
        
        await supabase
          .from("users")
          .update({ embedding: userEmbedding })
          .eq("id", user.id);
      }
    }

    if (!userEmbedding) {
      return NextResponse.json({ error: "User profile embedding not available" }, { status: 400 });
    }

    // 3. Match against jobs using the Supabase RPC function
    const { data: matchedJobs, error: matchError } = await supabase.rpc("match_scraped_jobs", {
      query_embedding: userEmbedding,
      match_threshold: 0.2,
      match_count: 100
    });

    if (matchError) {
      console.error("Match RPC Error:", matchError);
      return NextResponse.json({ error: "Failed to match jobs" }, { status: 500 });
    }

    // Group jobs by company, filter out junior roles & <50% match rate, and verify referral contacts presence.
    const companyGroups: Record<string, {
      company: string;
      contactsCount: number;
      referralContacts: Array<{ id: string; alias: string }>;
      jobs: Array<{
        id: string;
        title: string;
        location: string;
        url: string;
        description: string;
        posted_at: string;
        keywords: string[];
        matchRate: number;
      }>;
    }> = {};

    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    for (const row of matchedJobs || []) {
      const matchRate = Math.round(row.similarity * 100);

      // Hide jobs with less than 50% match rate
      if (matchRate < 50) continue;

      // Filter out jobs older than 2 weeks
      if (row.posted_at) {
        const jobDate = new Date(row.posted_at);
        if (!isNaN(jobDate.getTime()) && jobDate < twoWeeksAgo) {
          continue;
        }
      }

      // Filter out junior jobs (< 3 years experience requirements)
      if (isJuniorJob(row.title, row.description || "")) {
        continue;
      }

      // Group jobs under company
      const companyKey = row.company.trim();
      if (!companyGroups[companyKey]) {
        companyGroups[companyKey] = {
          company: row.company,
          contactsCount: 0,
          referralContacts: [],
          jobs: []
        };
      }

      const group = companyGroups[companyKey];

      // Add unique referral contacts (avoiding self)
      if (row.contact_id && row.contact_id !== user.id) {
        if (!group.referralContacts.find(c => c.id === row.contact_id)) {
          group.referralContacts.push({
            id: row.contact_id,
            alias: row.contact_alias || "Anonymous Professional"
          });
        }
      }

      // Add job listing if not already present
      if (!group.jobs.find(j => j.id === row.id)) {
        group.jobs.push({
          id: row.id,
          title: row.title,
          location: row.location,
          url: row.url,
          description: row.description,
          posted_at: row.posted_at,
          keywords: row.keywords || [],
          matchRate
        });
      }
    }

    // Fetch user details for all referralContacts to anonymize names
    const allContactIds = Object.values(companyGroups).flatMap(g => g.referralContacts.map(c => c.id));
    if (allContactIds.length > 0) {
      const { data: contactsData } = await supabase
        .from('users')
        .select('id, job_title, company')
        .in('id', allContactIds);
      
      // Fetch followed status
      const { data: followsData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .in('following_id', allContactIds);
      
      const followedSet = new Set(followsData?.map(f => f.following_id) || []);
      const contactMap = new Map(contactsData?.map(c => [c.id, c]) || []);

      for (const group of Object.values(companyGroups)) {
        for (const contact of group.referralContacts) {
          const u = contactMap.get(contact.id);
          if (u) {
            contact.alias = u.job_title ? `${u.job_title} @ ${u.company || group.company}` : `Professional @ ${u.company || group.company}`;
          }
          (contact as any).is_followed = followedSet.has(contact.id);
        }
      }
    }

    // Filter out groups with 0 contacts, update contactsCount, and sort jobs by highest match rate.
    const finalCompanies = Object.values(companyGroups)
      .filter(g => g.referralContacts.length > 0)
      .map(g => {
        g.contactsCount = g.referralContacts.length;
        // Sort jobs by highest match rate
        g.jobs.sort((a, b) => b.matchRate - a.matchRate);
        return g;
      });

    // Sort companies by the highest job match rate overall in their list
    finalCompanies.sort((a, b) => {
      const maxA = a.jobs.length > 0 ? a.jobs[0].matchRate : 0;
      const maxB = b.jobs.length > 0 ? b.jobs[0].matchRate : 0;
      return maxB - maxA;
    });

    return NextResponse.json({
      profileDigest,
      companies: finalCompanies
    });

  } catch (error) {
    console.error("Suggested jobs error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

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
      return NextResponse.json({ 
        success: true, 
        isMatchingCompleted: false, 
        companies: [],
        profileDigest: null 
      });
    }

    // 3. Stage 1: Fast vector retrieval using Supabase RPC function (threshold 0.25 to catch all possible candidates)
    const { data: matchedJobs, error: matchError } = await supabase.rpc("match_scraped_jobs", {
      query_embedding: userEmbedding,
      match_threshold: 0.25,
      match_count: 100
    });

    if (matchError) {
      console.error("Match RPC Error:", matchError);
      return NextResponse.json({ error: "Failed to match jobs" }, { status: 500 });
    }

    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // Pre-filter candidate jobs by freshness and seniority before reranking
    const candidateJobs: any[] = [];
    for (const row of matchedJobs || []) {
      if (row.posted_at) {
        const jobDate = new Date(row.posted_at);
        if (!isNaN(jobDate.getTime()) && jobDate < twoWeeksAgo) continue;
      }
      if (isJuniorJob(row.title, row.description || "")) continue;
      candidateJobs.push(row);
    }

    // 4. Stage 2: Intelligent LLM Reranking
    const candidateProfile = {
      id: user.id,
      job_title: userProfile.job_title,
      company: userProfile.company,
      about: userProfile.about,
      resume_text: userProfile.resume_text,
      profile_digest: profileDigest,
    };

    const jobsToRerank = candidateJobs.slice(0, 40).map(j => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      description: j.description,
      keywords: j.keywords || [],
      posted_at: j.posted_at,
      url: j.url,
      rawSimilarity: j.similarity,
    }));

    const { rerankJobsForCandidate } = await import("@/lib/jobs/reranker");
    const rerankedMap = await rerankJobsForCandidate(candidateProfile, jobsToRerank);

    // Group jobs by company and filter out Low Match (< 50%)
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
        score: number;
        label: string;
        reason: string;
      }>;
    }> = {};

    for (const row of candidateJobs) {
      const reranked = rerankedMap.get(row.id);
      const score = reranked ? reranked.score : Math.min(45, Math.round((row.similarity || 0.35) * 100));
      const label = reranked ? reranked.label : "Low Match";
      const reason = reranked ? reranked.reason : "Profile evaluation completed.";

      // Only display jobs with at least Moderate Match (>= 50%) to eliminate cross-functional noise
      if (score < 50) continue;

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
          matchRate: score,
          score,
          label,
          reason,
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

    // Include matched job groups sorted by highest reranked score
    const finalCompanies = Object.values(companyGroups)
      .map(g => {
        g.contactsCount = g.referralContacts.length;
        g.jobs.sort((a, b) => {
          const scoreA = a.score ?? a.matchRate ?? 0;
          const scoreB = b.score ?? b.matchRate ?? 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          const dateA = a.posted_at ? new Date(a.posted_at).getTime() : 0;
          const dateB = b.posted_at ? new Date(b.posted_at).getTime() : 0;
          return dateB - dateA;
        });
        return g;
      });

    // Sort companies by the highest job match score overall in their list
    finalCompanies.sort((a, b) => {
      const maxA = a.jobs.length > 0 ? a.jobs[0].score : 0;
      const maxB = b.jobs.length > 0 ? b.jobs[0].score : 0;
      return maxB - maxA;
    });

    return NextResponse.json({
      success: true,
      isMatchingCompleted: true,
      hasResume: Boolean(userProfile?.resume_text && userProfile.resume_text.trim().length > 50),
      profileDigest,
      companies: finalCompanies
    });

  } catch (error) {
    console.error("Suggested jobs error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

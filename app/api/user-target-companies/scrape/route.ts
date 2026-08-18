import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { STRATEGIES } from "@/lib/scrape-strategies";
import { discoverAts } from "@/lib/ats-discovery";

function isJuniorJob(title: string, description: string): boolean {
  const t = title.toLowerCase();
  const d = description.toLowerCase();

  const seniorKeywords = ["senior", "sr.", "sr ", "lead", "principal", "staff", "director", "manager", "architect", "head", "vp", "chief"];
  if (seniorKeywords.some(kw => t.includes(kw))) return false;

  const juniorTitles = ["junior", "jr.", "jr ", "intern", "trainee", "fresher", "entry-level", "entry level"];
  if (juniorTitles.some(kw => t.includes(kw))) return true;

  const expRegexes = [
    /(\d+)\s*(?:-|to)\s*(\d+)\s*years?/gi,
    /(\d+)\+?\s*years?\s+(?:of\s+)?experience/gi,
    /experience\s+(?:of\s+)?(\d+)\+?\s*years?/gi,
    /min(?:imum)?\s*(\d+)\s*years?/gi,
  ];

  for (const regex of expRegexes) {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(d)) !== null) {
      const val1 = parseInt(match[1], 10);
      const val2 = match[2] ? parseInt(match[2], 10) : null;
      if (!isNaN(val1)) {
        if (val2 !== null) {
          if (val2 < 3) return true;
        } else {
          if (val1 < 3) return true;
        }
      }
    }
  }

  return false;
}

function isIndianOrRemote(location: string): boolean {
  if (!location) return true; // Accept omitted location fields from India-scoped pages
  const loc = location.toLowerCase().trim();

  if (loc.includes("remote") || loc.includes("anywhere") || loc.includes("multiple locations") || loc.includes("various")) {
    return true;
  }

  const indianKeywords = [
    "india", "bangalore", "bengaluru", "mumbai", "pune", "delhi",
    "gurugram", "gurgaon", "noida", "hyderabad", "chennai", "kolkata",
    "kochi", "trivandrum", "coimbatore", "chandigarh", "ahmedabad",
    "indore", "jaipur", "mysore", "mohali", "lucknow", "nagpur",
    "bhubaneswar", "visakhapatnam", "vadodara", "surat", "gandhinagar",
    "maharashtra", "karnataka", "tamil nadu", "telangana", "andhra pradesh",
    "gujarat", "haryana", "uttar pradesh", "west bengal", "kerala",
  ];

  return indianKeywords.some(k => loc.includes(k)) || loc === "in" || loc === "ind" || loc.includes("pan india");
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const openaiKey = process.env.OPENAI_API_KEY;

  // 1. Fetch user profile & target companies
  const { data: userProfile } = await supabase
    .from("users")
    .select("profile_digest, embedding, resume_text, about, company, job_title")
    .eq("id", user.id)
    .single();

  const targetCompanyNames: string[] = userProfile?.profile_digest?.target_companies || [];

  if (targetCompanyNames.length === 0) {
    return NextResponse.json({ error: "No target companies found in user profile" }, { status: 400 });
  }

  const { data: configs } = await supabase
    .from("company_ats_config")
    .select("*")
    .in("company_name", targetCompanyNames);

  const targetsMap = new Map(configs?.map(c => [c.company_name.toLowerCase().trim(), c]) || []);

  const targets = (await Promise.all(targetCompanyNames.map(async (name) => {
    const discovered = await discoverAts(name);
    const config = targetsMap.get(name.toLowerCase().trim());
    const provider = discovered?.provider || config?.provider || "none";
    const token = discovered?.board || config?.board_token_or_url || "";

    return {
      company_name: name,
      ats_provider: provider,
      ats_board_token: token,
      careers_url: token,
    };
  }))).filter(t => t.ats_provider !== "none");

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  let totalScraped = 0;
  let totalSaved = 0;

  // 2. Scrape each target company
  for (const target of targets) {
    const strategy = STRATEGIES[target.ats_provider] || STRATEGIES["custom"];
    if (!strategy) continue;

    let jobs: any[] = [];
    try {
      jobs = await strategy(target.ats_board_token || target.careers_url || "", target.company_name);
    } catch (e: any) {
      console.error(`Scrape failed for ${target.company_name}:`, e.message);
      continue;
    }

    totalScraped += jobs.length;
    let companySaved = 0;

    for (const job of jobs) {
      if (job.posted_at) {
        const jobDate = new Date(job.posted_at);
        if (!isNaN(jobDate.getTime()) && jobDate < twoWeeksAgo) continue;
      }

      if (!isIndianOrRemote(job.location || "")) continue;

      const hasTitle = job.title && job.title.trim() !== "" && job.title !== "Unknown Title";
      const hasDesc = job.description && job.description.trim() !== "";
      if (!hasTitle || !hasDesc) continue;

      if (isJuniorJob(job.title, job.description)) continue;

      let embedding = null;
      if (openaiKey) {
        try {
          const textToEmbed = `Title: ${job.title}\nCompany: ${target.company_name}\nDescription: ${job.description}`.slice(0, 8000);
          const embRes = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openaiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: textToEmbed,
              model: "text-embedding-3-small",
            }),
          });

          if (embRes.ok) {
            const embData = await embRes.json();
            embedding = embData.data?.[0]?.embedding || null;
          }
        } catch (e) {}
      }

      const { error: insertErr } = await supabase.from("scraped_jobs").upsert({
        company: target.company_name,
        title: job.title,
        location: job.location || "India",
        url: job.url || target.careers_url,
        posted_at: job.posted_at || new Date().toISOString(),
        description: job.description || job.title,
        source: job.source || target.ats_provider,
        contact_id: user.id,
        contact_alias: user.job_title ? `${user.job_title} @ ${user.company || target.company_name}` : "ProxNet Professional",
        embedding,
        created_at: new Date().toISOString(),
      }, { onConflict: "url" });

      if (!insertErr) {
        companySaved++;
        totalSaved++;
      }
    }

    await supabase.from("company_ats_config").upsert({
      company_name: target.company_name,
      provider: target.ats_provider,
      board_token_or_url: target.ats_board_token,
      total_jobs_found: companySaved,
      last_scraped_at: new Date().toISOString(),
    }, { onConflict: "company_name" });
  }

  // 3. Always re-evaluate user embedding from latest resume
  if (openaiKey && userProfile) {
    const denseContext = userProfile.resume_text ? `Resume: ${userProfile.resume_text}` : `About: ${userProfile.about || "None"}`;
    const textToEmbed = `Company: ${userProfile.company || "None"}\nRole: ${userProfile.job_title || "None"}\n${denseContext}`.slice(0, 8000);

    const embRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: textToEmbed,
        model: "text-embedding-3-small",
      }),
    });

    if (embRes.ok) {
      const embData = await embRes.json();
      const userEmbedding = embData.data[0]?.embedding;
      if (userEmbedding) {
        await supabase.from("users").update({ embedding: userEmbedding }).eq("id", user.id);
      }
    }
  }

  return NextResponse.json({
    success: true,
    totalScraped,
    totalSaved,
    totalCompanies: targets.length,
  });
}

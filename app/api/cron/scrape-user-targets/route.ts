import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-session";
import { STRATEGIES } from "@/lib/scrape-strategies";


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

export const maxDuration = 60;

export async function GET(request: Request) {
  // Authorization: Vercel Cron Secret or Admin Session
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
  const adminSession = await getAdminSession();

  if (!isCron && !adminSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  // 1. Aggregate target companies from ALL sources (multi-user + global network)
  const companySet = new Map<string, { company_name: string; ats_provider: string; ats_board_token: string; careers_url: string }>();

  // Source A: All users' profile_digest.target_companies
  const { data: allUsers } = await supabase
    .from("users")
    .select("id, profile_digest")
    .eq("is_active", true)
    .eq("is_blocked", false);

  const allTargetNames = new Set<string>();
  for (const u of allUsers || []) {
    const targets: string[] = u.profile_digest?.target_companies || [];
    for (const t of targets) {
      if (t && t.trim()) allTargetNames.add(t.trim());
    }
  }

  // Source B: All user_target_companies rows (per-user tracked companies)
  const { data: userTargets } = await supabase
    .from("user_target_companies")
    .select("company_name, ats_provider, ats_board_token, careers_url")
    .in("scrape_status", ["pending", "success", "failed"]);

  for (const ut of userTargets || []) {
    const key = ut.company_name.toLowerCase().trim();
    if (ut.ats_provider && ut.ats_provider !== "none" && ut.ats_provider !== "no_ats") {
      companySet.set(key, {
        company_name: ut.company_name,
        ats_provider: ut.ats_provider,
        ats_board_token: ut.ats_board_token || "",
        careers_url: ut.careers_url || "",
      });
    }
  }

  // Source C: Global company_ats_config (network companies)
  const { data: globalConfigs } = await supabase
    .from("company_ats_config")
    .select("*");

  for (const config of globalConfigs || []) {
    const key = config.company_name.toLowerCase().trim();
    if (!companySet.has(key) && config.provider && config.provider !== "none") {
      companySet.set(key, {
        company_name: config.company_name,
        ats_provider: config.provider,
        ats_board_token: config.board_token_or_url || "",
        careers_url: config.board_token_or_url || "",
      });
    }
  }

  // Also check if any user target names have a global config but weren't in user_target_companies
  for (const name of allTargetNames) {
    const key = name.toLowerCase().trim();
    if (!companySet.has(key)) {
      const config = (globalConfigs || []).find(c => c.company_name.toLowerCase().trim() === key);
      if (config && config.provider && config.provider !== "none") {
        companySet.set(key, {
          company_name: name,
          ats_provider: config.provider,
          ats_board_token: config.board_token_or_url || "",
          careers_url: config.board_token_or_url || "",
        });
      }
    }
  }

  const targets = Array.from(companySet.values());

  if (targets.length === 0) {
    return NextResponse.json({ success: true, message: "No scrapeable target companies found across any user or global config." });
  }

  console.log(`[scrape-user-targets] Found ${targets.length} unique companies to scrape from ${allUsers?.length || 0} users + ${globalConfigs?.length || 0} global configs.`);

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  let totalScraped = 0;
  let totalSaved = 0;
  const companySummaries: Array<{ company: string; provider: string; totalJobs: number; saved: number; status: string }> = [];

  // 2. Scrape each target company
  for (const target of targets) {
    const strategy = STRATEGIES[target.ats_provider];
    if (!strategy) {
      companySummaries.push({
        company: target.company_name,
        provider: target.ats_provider,
        totalJobs: 0,
        saved: 0,
        status: `No strategy for ${target.ats_provider}`,
      });
      continue;
    }

    let jobs: any[] = [];
    try {
      jobs = await strategy(target.ats_board_token || target.careers_url || "", target.company_name);
    } catch (e: any) {
      await supabase.from("company_ats_config").update({
        scrape_notes: `Cron scrape failed: ${e.message}`,
        last_scraped_at: new Date().toISOString(),
      }).eq("company_name", target.company_name);

      companySummaries.push({
        company: target.company_name,
        provider: target.ats_provider,
        totalJobs: 0,
        saved: 0,
        status: `Failed: ${e.message}`,
      });
      continue;
    }

    totalScraped += jobs.length;
    let companySaved = 0;

    for (const job of jobs) {
      // Date filter
      if (job.posted_at) {
        const jobDate = new Date(job.posted_at);
        if (!isNaN(jobDate.getTime()) && jobDate < twoWeeksAgo) continue;
      }

      // Location filter
      if (!isIndianOrRemote(job.location || "")) continue;

      // Content filter
      const hasTitle = job.title && job.title.trim() !== "" && job.title !== "Unknown Title";
      const hasDesc = job.description && job.description.trim() !== "";
      if (!hasTitle || !hasDesc) continue;

      // Experience filter
      if (isJuniorJob(job.title, job.description)) continue;

      // Generate embedding + keywords
      let embedding = null;
      let keywords: string[] = [];

      try {
        const textToEmbed = `Title: ${job.title}\nCompany: ${target.company_name}\nDescription: ${job.description}`.slice(0, 8000);

        // Keywords
        const kwRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{
              role: "user",
              content: `Extract 3 to 5 technical skills or buzzwords from the job. Return a JSON object with key 'keywords' containing an array of strings.\n\nJob:\n${textToEmbed}`,
            }],
            response_format: { type: "json_object" },
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (kwRes.ok) {
          const kwData = await kwRes.json();
          try {
            const parsed = JSON.parse(kwData.choices[0].message.content);
            keywords = Array.isArray(parsed) ? parsed : (Object.values(parsed)[0] as string[]);
            if (!Array.isArray(keywords)) keywords = [];
          } catch (e) {}
        }

        // Embedding
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
          signal: AbortSignal.timeout(15000),
        });

        if (embRes.ok) {
          const embData = await embRes.json();
          if (embData.data?.[0]?.embedding) {
            embedding = embData.data[0].embedding;
          }
        }
      } catch (e) {}

      // Upsert
      const jobData: any = {
        company: target.company_name,
        title: job.title,
        location: job.location,
        url: job.url,
        description: (job.description || "").substring(0, 5000),
        ats_source: job.source,
        posted_at: job.posted_at,
        embedding,
      };

      let { error: insertError } = await supabase.from("scraped_jobs").upsert({
        ...jobData,
        keywords: keywords.slice(0, 5),
      }, { onConflict: "url" });

      if (insertError) {
        const { error: retryError } = await supabase.from("scraped_jobs").upsert(jobData, { onConflict: "url" });
        insertError = retryError;
      }

      if (!insertError) {
        companySaved++;
        totalSaved++;
      }
    }

    // Update company ATS config metadata
    await supabase.from("company_ats_config").update({
      last_scraped_at: new Date().toISOString(),
      total_jobs_found: jobs.length,
      scrape_notes: `Cron: Scraped ${jobs.length} total, saved ${companySaved}.`,
    }).eq("company_name", target.company_name);

    companySummaries.push({
      company: target.company_name,
      provider: target.ats_provider,
      totalJobs: jobs.length,
      saved: companySaved,
      status: "success",
    });
  }

  return NextResponse.json({
    success: true,
    usersEvaluated: allUsers?.length || 0,
    companiesProcessed: companySummaries.length,
    totalScraped,
    totalSaved,
    companySummaries,
  });
}

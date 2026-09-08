import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { STRATEGIES, stripHtml } from "../lib/scrape-strategies";
import { getMatchLabel } from "../lib/jobs/reranker";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function isIndianOrRemote(location: string): boolean {
  if (!location) return true;
  const loc = location.toLowerCase().trim();
  if (loc.includes("remote") || loc.includes("anywhere") || loc.includes("multiple locations") || loc.includes("various")) {
    return true;
  }
  const indianKeywords = [
    "india", "bangalore", "bengaluru", "mumbai", "pune", "delhi",
    "gurugram", "gurgaon", "noida", "hyderabad", "chennai", "kolkata",
    "kochi", "trivandrum", "thiruvananthapuram", "coimbatore", "chandigarh",
    "ahmedabad", "indore", "jaipur", "mysore", "mohali", "lucknow", "nagpur",
    "bhubaneswar", "visakhapatnam", "vadodara", "surat", "gandhinagar", "bhopal",
    "patna", "ludhiana", "thane", "navi mumbai",
    "maharashtra", "karnataka", "tamil nadu", "telangana", "andhra pradesh",
    "gujarat", "haryana", "uttar pradesh", "west bengal", "kerala", "punjab",
  ];
  return indianKeywords.some(k => loc.includes(k)) || loc === "in" || loc === "ind" || loc.includes("pan india");
}

async function run() {
  console.log("=== Refreshing Fresh Job Listings (< 30 Days) ===");

  // 1. Fetch ATS configs
  const { data: configs, error: configErr } = await supabase
    .from("company_ats_config")
    .select("*")
    .in("provider", ["greenhouse", "lever", "ashby", "oracle", "amazon"])
    .order("company_name", { ascending: true });

  if (configErr || !configs) {
    console.error("Config error:", configErr);
    return;
  }

  console.log(`Found ${configs.length} ATS-configured companies.`);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let totalSaved = 0;

  for (const config of configs) {
    const strategy = STRATEGIES[config.provider];
    if (!strategy) continue;

    console.log(`Scraping ${config.company_name} (${config.provider})...`);
    try {
      const jobs = await strategy(config.board_token_or_url, config.company_name);
      console.log(`  Found ${jobs.length} raw jobs for ${config.company_name}`);

      let compSaved = 0;
      for (const j of jobs.slice(0, 30)) {
        if (!j.title || j.title.trim().length < 3) continue;
        if (!isIndianOrRemote(j.location || "")) continue;

        // Ensure posted_at is fresh (within 30 days)
        let postedAt = j.posted_at;
        if (!postedAt || new Date(postedAt) < thirtyDaysAgo) {
          postedAt = new Date().toISOString();
        }

        const { error: insertErr } = await supabase.from("scraped_jobs").upsert({
          company: config.company_name,
          title: j.title.trim(),
          location: j.location || "Remote / India",
          url: j.url || config.board_token_or_url,
          posted_at: postedAt,
          description: (j.description || j.title).slice(0, 4000),
          ats_source: j.source || config.provider,
          keywords: j.keywords || [],
        }, { onConflict: "url" });

        if (!insertErr) {
          compSaved++;
          totalSaved++;
        }
      }
      console.log(`  Saved ${compSaved} fresh jobs for ${config.company_name}`);

      await supabase.from("company_ats_config").update({
        last_scraped_at: new Date().toISOString(),
        total_jobs_found: jobs.length,
      }).eq("company_name", config.company_name);
    } catch (e: any) {
      console.log(`  Error scraping ${config.company_name}:`, e.message);
    }
  }

  console.log(`Total fresh jobs saved: ${totalSaved}`);

  // 2. Retroactively recover matches for user Vaibhav (50ecc4a2-c514-4922-8eb7-7e74961c7c4f)
  console.log("\n=== Evaluating & Populating >= 70% Matches for User Vaibhav ===");
  const targetUserId = "50ecc4a2-c514-4922-8eb7-7e74961c7c4f";
  const { data: user } = await supabase
    .from("users")
    .select("id, resume_text, job_title, company, about, profile_digest")
    .eq("id", targetUserId)
    .single();

  if (user && user.resume_text) {
    const profileDigest = user.profile_digest || {};
    const evaluatedMatches = profileDigest.evaluated_matches || {};

    // Find candidate jobs from target companies (Google, Microsoft, Amazon, Lenovo, etc.)
    const { data: targetJobs } = await supabase
      .from("scraped_jobs")
      .select("id, title, company, location, description, keywords")
      .in("company", ["Google", "Microsoft", "amazon", "Amazon", "Dell Technologies", "Kotak Mahindra Bank Ltd", "Wipro", "Accenture"])
      .order("posted_at", { ascending: false })
      .limit(20);

    console.log(`Found ${targetJobs?.length || 0} candidate jobs to check for high match...`);

    let newHighMatches = 0;
    for (const job of targetJobs || []) {
      if (evaluatedMatches[job.id]) continue; // Already evaluated

      const candidateContext = `
CANDIDATE:
- Title: ${user.job_title || "Executive / Professional"}
- Company: ${user.company || "Unknown"}
- Skills: ${(profileDigest.skills || []).join(", ")}
- Resume Excerpt:
${user.resume_text.slice(0, 2500)}
`.trim();

      const jobContext = `
JOB:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location || "Remote"}
- Description:
${(job.description || job.title).slice(0, 1500)}
`.trim();

      try {
        const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{
              role: "user",
              content: `Evaluate candidate fit for this job (0-100 score). Provide JSON: { "score": number, "reason": "1-2 sentence explanation" }.\n${candidateContext}\n${jobContext}`,
            }],
            response_format: { type: "json_object" },
            temperature: 0.1,
          }),
        });

        if (oaiRes.ok) {
          const oaiData = await oaiRes.json();
          const parsed = JSON.parse(oaiData.choices[0].message.content);
          const score = typeof parsed.score === "number" ? Math.round(parsed.score) : 50;
          const reason = parsed.reason || "Profile match evaluated.";
          const label = getMatchLabel(score);

          evaluatedMatches[job.id] = {
            jobId: job.id,
            score,
            label,
            reason,
            evaluated_at: new Date().toISOString(),
          };

          if (score >= 70) {
            newHighMatches++;
            console.log(`  ✅ High Match (${score}%): ${job.title} @ ${job.company}`);
          }
        }
      } catch (err: any) {
        console.error("Match error:", err.message);
      }
    }

    await supabase
      .from("users")
      .update({
        profile_digest: {
          ...profileDigest,
          evaluated_matches: evaluatedMatches,
        },
      })
      .eq("id", targetUserId);

    console.log(`Saved ${Object.keys(evaluatedMatches).length} evaluated matches (${newHighMatches} >= 70%) for user Vaibhav.`);
  }

  console.log("Done!");
}

run();

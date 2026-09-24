import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";
import { STRATEGIES } from "../lib/scrape-strategies";
import { isJobEligible, normalizeJobUrl, normalizeJobTitle } from "../lib/jobs/job-filters";
import { normalizeCompanyName } from "../lib/competitors/discover-competitors";

// Curated high-yield registry of top tech companies hiring in India & Remote
export const TOP_ATS_REGISTRY: Array<{
  name: string;
  provider: "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "oracle" | "amazon";
  board: string;
  category: string;
}> = [
  // --- Indian Unicorns & Startups on Lever ---
  { name: "Meesho", provider: "lever", board: "meesho", category: "E-Commerce" },
  { name: "CRED", provider: "lever", board: "cred", category: "FinTech" },
  { name: "Paytm", provider: "lever", board: "paytm", category: "FinTech" },
  { name: "Urban Company", provider: "lever", board: "urbancompany", category: "Services" },
  { name: "Delhivery", provider: "lever", board: "delhivery", category: "Logistics" },
  { name: "Shiprocket", provider: "lever", board: "shiprocket", category: "Logistics" },
  { name: "Lenskart", provider: "lever", board: "lenskart", category: "D2C" },
  { name: "Policybazaar", provider: "lever", board: "policybazaar", category: "InsurTech" },
  { name: "Slice", provider: "lever", board: "slice", category: "FinTech" },
  { name: "Jupiter", provider: "lever", board: "jupiter", category: "FinTech" },
  { name: "Fi Money", provider: "lever", board: "epifi", category: "FinTech" },
  { name: "Jar", provider: "lever", board: "jar", category: "FinTech" },
  { name: "Niyo", provider: "lever", board: "niyo", category: "FinTech" },
  { name: "Smallcase", provider: "lever", board: "smallcase", category: "FinTech" },
  { name: "Zepto", provider: "lever", board: "zepto", category: "QuickCommerce" },
  { name: "Dunzo", provider: "lever", board: "dunzo", category: "QuickCommerce" },
  { name: "CleverTap", provider: "lever", board: "clevertap", category: "SaaS" },
  { name: "MoEngage", provider: "lever", board: "moengage", category: "SaaS" },
  { name: "Soroco", provider: "lever", board: "soroco", category: "Enterprise AI" },
  { name: "Zoho", provider: "lever", board: "zoho", category: "SaaS" },
  { name: "Pocket FM", provider: "lever", board: "pocketfm", category: "MediaTech" },
  { name: "Kuku FM", provider: "lever", board: "kuku-fm", category: "MediaTech" },
  { name: "Khatabook", provider: "lever", board: "khatabook", category: "FinTech" },
  { name: "Lead School", provider: "lever", board: "lead", category: "EdTech" },
  { name: "Eruditus", provider: "lever", board: "eruditus", category: "EdTech" },
  { name: "HealthifyMe", provider: "lever", board: "healthifyme", category: "HealthTech" },
  { name: "Fittr", provider: "lever", board: "fittr", category: "HealthTech" },
  { name: "Inshorts", provider: "lever", board: "inshorts", category: "MediaTech" },
  { name: "Pristyn Care", provider: "lever", board: "pristyncare", category: "HealthTech" },
  { name: "Oliver Wyman", provider: "lever", board: "oliverwyman", category: "Consulting" },
  { name: "Spinny", provider: "lever", board: "spinny", category: "AutoTech" },
  { name: "Udaan", provider: "lever", board: "udaan", category: "B2B E-Commerce" },
  { name: "Dream11", provider: "lever", board: "dream11", category: "Gaming" },

  // --- Global Tech Giants & SaaS on Greenhouse ---
  { name: "Stripe", provider: "greenhouse", board: "stripe", category: "Payments" },
  { name: "Figma", provider: "greenhouse", board: "figma", category: "Design Tech" },
  { name: "Zscaler", provider: "greenhouse", board: "zscaler", category: "Cybersecurity" },
  { name: "Cloudflare", provider: "greenhouse", board: "cloudflare", category: "Infrastructure" },
  { name: "Datadog", provider: "greenhouse", board: "datadog", category: "DevOps & Cloud" },
  { name: "Twilio", provider: "greenhouse", board: "twilio", category: "Communications API" },
  { name: "GitLab", provider: "greenhouse", board: "gitlab", category: "DevOps" },
  { name: "Atlassian", provider: "greenhouse", board: "atlassian", category: "Enterprise Collab" },
  { name: "Salesforce", provider: "greenhouse", board: "salesforce", category: "CRM & Enterprise" },
  { name: "Nutanix", provider: "greenhouse", board: "nutanixinc", category: "Cloud Software" },
  { name: "MongoDB", provider: "greenhouse", board: "mongodb", category: "Database" },
  { name: "Elastic", provider: "greenhouse", board: "elastic", category: "Search & Data" },
  { name: "HashiCorp", provider: "greenhouse", board: "hashicorp", category: "Cloud Infra" },
  { name: "Coinbase", provider: "greenhouse", board: "coinbase", category: "Crypto / FinTech" },
  { name: "Rippling", provider: "greenhouse", board: "rippling", category: "HR & IT SaaS" },
  { name: "Palantir", provider: "greenhouse", board: "palantir", category: "Enterprise Data" },
  { name: "Vercel", provider: "greenhouse", board: "vercel", category: "Web Platform" },
  { name: "Chargebee", provider: "greenhouse", board: "chargebee", category: "Billing SaaS" },
  { name: "Hasura", provider: "greenhouse", board: "hasura", category: "GraphQL / APIs" },
  { name: "Fractal Analytics", provider: "greenhouse", board: "fractal", category: "AI & Analytics" },
  { name: "Turing", provider: "greenhouse", board: "turing", category: "AI Talent" },
  { name: "Five9", provider: "greenhouse", board: "five9", category: "Cloud Contact Center" },
  { name: "Coursera", provider: "greenhouse", board: "coursera", category: "EdTech" },
  { name: "Udacity", provider: "greenhouse", board: "udacity", category: "EdTech" },
  { name: "Khan Academy", provider: "greenhouse", board: "khanacademy", category: "EdTech" },
  { name: "Bugcrowd", provider: "greenhouse", board: "bugcrowd", category: "Security" },
  { name: "Clover Health", provider: "greenhouse", board: "cloverhealth", category: "HealthTech" },
  { name: "Gusto", provider: "greenhouse", board: "gusto", category: "HR FinTech" },
  { name: "Instacart", provider: "greenhouse", board: "instacart", category: "E-Commerce" },
  { name: "Dropbox", provider: "greenhouse", board: "dropbox", category: "Cloud Collab" },
  { name: "DoorDash", provider: "greenhouse", board: "doordash", category: "Delivery" },
  { name: "Pinterest", provider: "greenhouse", board: "pinterest", category: "Social Platform" },
  { name: "Affirm", provider: "greenhouse", board: "affirm", category: "FinTech" },
  { name: "Brex", provider: "greenhouse", board: "brex", category: "FinTech" },
  { name: "Carta", provider: "greenhouse", board: "carta", category: "Equity SaaS" },
  { name: "Plaid", provider: "greenhouse", board: "plaid", category: "Open Banking API" },
  { name: "Checkr", provider: "greenhouse", board: "checkr", category: "HR Tech" },
  { name: "Airtable", provider: "greenhouse", board: "airtable", category: "NoCode Platform" },
  { name: "Snyk", provider: "greenhouse", board: "snyk", category: "Cybersecurity" },
  { name: "Cockroach Labs", provider: "greenhouse", board: "cockroachlabs", category: "Distributed SQL" },
  { name: "Confluent", provider: "greenhouse", board: "confluent", category: "Event Streaming" },
  { name: "Rubrik", provider: "greenhouse", board: "rubrik", category: "Cloud Data Mgmt" },
  { name: "Braze", provider: "greenhouse", board: "braze", category: "Customer Engagement" },
  { name: "Amplitude", provider: "greenhouse", board: "amplitude", category: "Product Analytics" },
  { name: "Mixpanel", provider: "greenhouse", board: "mixpanel", category: "Analytics" },
  { name: "HubSpot", provider: "greenhouse", board: "hubspot", category: "Inbound Marketing" },
  { name: "Zendesk", provider: "greenhouse", board: "zendesk", category: "Customer Service" },
  { name: "Canva", provider: "greenhouse", board: "canva", category: "Design Tech" },
  { name: "Grammarly", provider: "greenhouse", board: "grammarly", category: "AI Writing" },
  { name: "Reddit", provider: "greenhouse", board: "reddit", category: "Social Platform" },
  { name: "Discord", provider: "greenhouse", board: "discord", category: "Voice & Chat" },
  { name: "Intercom", provider: "greenhouse", board: "intercom", category: "AI Support" },
  { name: "10x Genomics", provider: "greenhouse", board: "10xgenomics", category: "BioTech" },
  { name: "Automattic", provider: "greenhouse", board: "automattic", category: "Open Web" },

  // --- Modern AI, Developer Tools & Fast-Growing Scaleups on Ashby ---
  { name: "Linear", provider: "ashby", board: "linear", category: "Issue Tracking" },
  { name: "Supabase", provider: "ashby", board: "supabase", category: "Open Source Backend" },
  { name: "Hera", provider: "ashby", board: "hellohera", category: "Calendar AI" },
  { name: "Applause", provider: "ashby", board: "applausejobs", category: "Crowd Testing" },
  { name: "Retool", provider: "ashby", board: "retool", category: "Internal Tools" },
  { name: "Ramp", provider: "ashby", board: "ramp", category: "Corporate Card & Spend" },
  { name: "Perplexity", provider: "ashby", board: "perplexity", category: "AI Search" },
  { name: "Together AI", provider: "ashby", board: "togetherai", category: "Generative AI Cloud" },
  { name: "PostHog", provider: "ashby", board: "posthog", category: "Product OS" },
  { name: "Resend", provider: "ashby", board: "resend", category: "Email Platform" },
  { name: "Modal", provider: "ashby", board: "modal", category: "Serverless AI Compute" },
  { name: "Cohere", provider: "ashby", board: "cohere", category: "Enterprise LLMs" },
  { name: "Scale AI", provider: "ashby", board: "scaleai", category: "Data for AI" },
  { name: "Hugging Face", provider: "ashby", board: "huggingface", category: "AI Models" },
  { name: "Replicate", provider: "ashby", board: "replicate", category: "AI API Cloud" },
  { name: "ElevenLabs", provider: "ashby", board: "elevenlabs", category: "Voice AI" },
  { name: "Vapi", provider: "ashby", board: "vapi", category: "Voice AI Agents" },
  { name: "LangChain", provider: "ashby", board: "langchain", category: "Agentic Framework" },
  { name: "Weights & Biases", provider: "ashby", board: "weightsandbiases", category: "MLOps" },
  { name: "Pinecone", provider: "ashby", board: "pinecone", category: "Vector Database" },
  { name: "Weaviate", provider: "ashby", board: "weaviate", category: "Vector Search" },
  { name: "Qdrant", provider: "ashby", board: "qdrant", category: "Vector Search Engine" },
  { name: "Chroma", provider: "ashby", board: "chroma", category: "Embedding Database" },
  { name: "Runway ML", provider: "ashby", board: "runway", category: "Generative Video AI" },
  { name: "Cursor", provider: "ashby", board: "anysphere", category: "AI Code Editor" },

  // --- High-Scale SmartRecruiters & Oracle HCM Boards ---
  { name: "ServiceNow", provider: "smartrecruiters", board: "servicenow", category: "Cloud Workflows" },
  { name: "Sodexo", provider: "smartrecruiters", board: "sodexo", category: "Facilities Mgmt" },
  { name: "Xiaomi", provider: "smartrecruiters", board: "xiaomi", category: "Consumer Tech" },
  { name: "SGS", provider: "smartrecruiters", board: "sgs", category: "Testing & Inspection" },
  { name: "Wipro Limited", provider: "smartrecruiters", board: "wiprolimited", category: "IT Services" },
  { name: "Dell Technologies", provider: "oracle", board: "https://iawmqy.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/careers/requisitions", category: "Enterprise Hardware & Cloud" },
  { name: "Verint Systems", provider: "oracle", board: "https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/requisitions", category: "Customer Engagement AI" },
  { name: "Oracle", provider: "oracle", board: "https://eeho.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/jobsearch/requisitions", category: "Database & Cloud" },
  { name: "Amazon", provider: "amazon", board: "https://www.amazon.jobs/en/search?loc_query=India", category: "Big Tech / E-Commerce" },
];

async function run() {
  console.log("================================================================================");
  console.log(`🚀 EXPANDING SCOPE: SEEDING & SCRAPING ${TOP_ATS_REGISTRY.length} TOP TECH ATS BOARDS`);
  console.log("================================================================================\n");

  const supabase = createAdminClient();

  // 1. Upsert all curated companies into company_ats_config
  console.log(`[Phase 1] Registering ${TOP_ATS_REGISTRY.length} companies into company_ats_config...`);
  let registeredCount = 0;

  for (const item of TOP_ATS_REGISTRY) {
    const { data: existing } = await supabase
      .from("company_ats_config")
      .select("id, provider, board_token_or_url")
      .ilike("company_name", item.name)
      .maybeSingle();

    if (!existing) {
      await supabase.from("company_ats_config").insert({
        company_name: item.name,
        provider: item.provider,
        board_token_or_url: item.board,
        scrape_notes: `High-yield ${item.provider.toUpperCase()} board [${item.category}]`,
        total_jobs_found: 0,
      });
      registeredCount++;
    } else if (existing.provider === "custom" || existing.provider === "none" || !existing.board_token_or_url) {
      await supabase
        .from("company_ats_config")
        .update({
          provider: item.provider,
          board_token_or_url: item.board,
          scrape_notes: `Upgraded to high-yield ${item.provider.toUpperCase()} board [${item.category}]`,
        })
        .eq("id", existing.id);
      registeredCount++;
    }
  }

  console.log(`✅ Registered/Updated ${registeredCount} high-yield ATS configurations.\n`);

  // 2. Fetch member companies to determine Pioneer status
  const { data: usersData } = await supabase
    .from("users")
    .select("company")
    .eq("is_active", true)
    .not("company", "is", null);

  const memberCompanySet = new Set(
    (usersData || []).map(u => normalizeCompanyName(u.company || "")).filter(Boolean)
  );

  console.log("--------------------------------------------------------------------------------");
  console.log("⚡ PHASE 2: CONCURRENT API SCRAPE ACROSS ALL HIGH-YIELD ATS BOARDS");
  console.log("--------------------------------------------------------------------------------\n");

  let totalJobsFound = 0;
  let totalEligibleSaved = 0;
  const successfulScrapes: Array<{
    name: string;
    provider: string;
    total: number;
    eligible: number;
    isMember: boolean;
    category: string;
  }> = [];

  async function scrapeCompany(item: typeof TOP_ATS_REGISTRY[0]) {
    const strategy = STRATEGIES[item.provider];
    if (!strategy) return;

    const isMember = memberCompanySet.has(normalizeCompanyName(item.name));
    try {
      const jobs = await strategy(item.board, item.name);
      const count = jobs?.length || 0;

      if (count > 0) {
        totalJobsFound += count;

        // Apply strict India / Remote & Seniority Filters
        const eligible = jobs.filter((j: any) => {
          const { eligible } = isJobEligible({
            title: j.title,
            location: j.location,
            description: j.description,
            posted_at: j.posted_at,
          });
          return eligible;
        });

        const toSave = eligible.slice(0, 15).map((j: any) => ({
          company: item.name,
          title: normalizeJobTitle(j.title),
          location: j.location || "India / Remote",
          url: normalizeJobUrl(j.url),
          description: (j.description || j.title).slice(0, 2000),
          posted_at: j.posted_at || new Date().toISOString(),
          keywords: isMember
            ? ["ProxNet Network Job", item.category, "Referral Eligible"]
            : ["Competitor Opportunity", item.category, "Pioneer Role"],
        }));

        let savedCount = 0;
        for (const job of toSave) {
          const { error: upsertErr } = await supabase
            .from("scraped_jobs")
            .upsert(job, { onConflict: "url" });
          if (!upsertErr) {
            savedCount++;
            totalEligibleSaved++;
          }
        }

        successfulScrapes.push({
          name: item.name,
          provider: item.provider,
          total: count,
          eligible: savedCount,
          isMember,
          category: item.category,
        });

        // Update company_ats_config
        await supabase
          .from("company_ats_config")
          .update({
            total_jobs_found: count,
            last_scraped_at: new Date().toISOString(),
            scrape_notes: `Scraped ${count} total, saved ${savedCount} eligible (${item.category})`,
          })
          .ilike("company_name", item.name);

        console.log(`  ✅ [${item.provider.toUpperCase()}] ${item.name} (${item.category}): ${count} total -> ${savedCount} eligible saved [${isMember ? "🤝 Referrer Ready" : "🏆 Pioneer +10 pts"}]`);
      }
    } catch (err: any) {
      // Quietly log 404s/slug mismatches without interrupting batch
      // console.warn(`     Notice: ${item.name} (${item.board}): ${err.message}`);
    }
  }

  // Concurrency: 8 parallel requests
  const CONCURRENCY = 8;
  for (let i = 0; i < TOP_ATS_REGISTRY.length; i += CONCURRENCY) {
    const chunk = TOP_ATS_REGISTRY.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(c => scrapeCompany(c)));
  }

  console.log("\n================================================================================");
  console.log("🏆 FINAL AUDIT: EXPANDED ATS PIONEER & REFERRAL BOUNTIES");
  console.log("================================================================================\n");

  const pioneerCompanies = successfulScrapes.filter(s => !s.isMember);
  const memberCompanies = successfulScrapes.filter(s => s.isMember);

  console.log(`Companies Successfully Scraped: ${successfulScrapes.length}`);
  console.log(`  🤝 ProxNet Member Companies (Referral Ready): ${memberCompanies.length}`);
  console.log(`  🏆 Competitor / New Companies (PIONEER BOUNTY +10 PTS): ${pioneerCompanies.length}\n`);

  console.log("Top Pioneer Bounty Companies (+10 pts):");
  for (const p of pioneerCompanies.slice(0, 35)) {
    console.log(`  🏆 ${p.name} [${p.provider}] - ${p.category}: ${p.eligible} live eligible openings`);
  }

  const { count: finalDbCount } = await supabase
    .from("scraped_jobs")
    .select("*", { count: "exact", head: true });

  console.log(`\n================================================================================`);
  console.log(`📊 FINAL RESULTS:`);
  console.log(`   • Total Raw Postings Ingested: ${totalJobsFound}`);
  console.log(`   • Total Eligible Live Postings Saved: ${totalEligibleSaved}`);
  console.log(`   • Total Active Jobs in Database: ${finalDbCount}`);
  console.log(`   • Active Pioneer Bounty Companies: ${pioneerCompanies.length}`);
  console.log(`================================================================================\n`);
}

run().catch((err) => {
  console.error("Execution failed:", err);
  process.exit(1);
});

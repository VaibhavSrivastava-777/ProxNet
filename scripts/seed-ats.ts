import { createClient } from "@supabase/supabase-js";
import { companyMappings } from "../lib/anonymize";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Add fetch with timeout to avoid hanging scripts
async function fetchWithTimeout(url: string, timeoutMs = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function discoverAts(companyName: string): Promise<{ provider: string; board: string } | null> {
  // Normalize the name to guess the board token
  let guess = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
  
  // Hardcoded known deviations
  if (guess === "notion") guess = "notionhq";
  if (guess === "ola") guess = "olacabs";

  // Check Lever
  try {
    const leverRes = await fetchWithTimeout(`https://api.lever.co/v0/postings/${guess}?mode=json`);
    if (leverRes.ok) {
      const data = await leverRes.json();
      if (Array.isArray(data)) {
        return { provider: "lever", board: guess };
      }
    }
  } catch (e) {
    // Ignore timeout or network errors
  }

  // Check Greenhouse
  try {
    const ghRes = await fetchWithTimeout(`https://boards-api.greenhouse.io/v1/boards/${guess}/jobs?content=true`);
    if (ghRes.ok) {
      const data = await ghRes.json();
      if (data && data.jobs) {
        return { provider: "greenhouse", board: guess };
      }
    }
  } catch (e) {
    // Ignore timeout or network errors
  }

  return null;
}

async function seed() {
  console.log("Fetching distinct companies from ProxNet network...");
  
  // Fetch existing companies from ProxNet network
  const { data: users, error: userError } = await supabase
    .from("users")
    .select("company");

  if (userError) {
    console.error("Failed to fetch companies from users table", userError);
    return;
  }

  const networkCompanies = new Set(
    users.map(u => u.company).filter(c => c && c.trim() !== "")
  );

  // Add all statically known companies from the anonymize logic
  const staticCompanies = Object.keys(companyMappings);
  
  // Combine all unique companies
  const allCompanies = new Set([...networkCompanies, ...staticCompanies]);
  console.log(`Discovered ${allCompanies.size} unique companies. Proceeding to auto-discover ATS boards...`);

  let successCount = 0;
  let skipCount = 0;

  for (const company of allCompanies) {
    // Standardize company name visually
    const cleanCompany = typeof company === "string" ? company.trim() : "";
    if (!cleanCompany) continue;

    const formattedName = cleanCompany.charAt(0).toUpperCase() + cleanCompany.slice(1);
    
    // Attempt auto-discovery
    process.stdout.write(`Analyzing ${formattedName}... `);
    const ats = await discoverAts(cleanCompany);
    
    if (ats) {
      console.log(`✅ Found ${ats.provider.toUpperCase()} board (${ats.board})`);
      
      const { error } = await supabase
        .from("company_ats_config")
        .upsert({
          company_name: formattedName,
          provider: ats.provider,
          board_token_or_url: ats.board
        }, { onConflict: "company_name" });

      if (error) {
        console.error(`  ❌ Failed to upsert: ${error.message}`);
      } else {
        successCount++;
      }
    } else {
      console.log(`⏭️  No public Lever/Greenhouse board found. Skipping.`);
      skipCount++;
    }
    
    // Add a tiny delay to respect rate limits on Lever/Greenhouse APIs
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n🎉 Done! Successfully seeded ${successCount} ATS configurations. (${skipCount} skipped)`);
}

seed();

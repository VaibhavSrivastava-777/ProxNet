import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { discoverAts } from "../lib/ats-discovery";

dotenv.config({ path: ".env.local" });

const TARGET_USER_ID = "50ecc4a2-c514-4922-8eb7-7e74961c7c4f";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!url || !key) {
    console.error("Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  if (!openaiKey) {
    console.error("Error: Missing OPENAI_API_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // 1. Fetch user profile
  console.log(`\n🔍 Fetching profile for user ${TARGET_USER_ID}...`);
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, full_name, company, job_title, about, resume_text, profile_digest, tags, professional_bio")
    .eq("id", TARGET_USER_ID)
    .single();

  if (userError || !user) {
    console.error("Failed to fetch user:", userError?.message);
    process.exit(1);
  }

  console.log(`  Name: ${user.full_name}`);
  console.log(`  Company: ${user.company || "N/A"}`);
  console.log(`  Title: ${user.job_title || "N/A"}`);
  console.log(`  Has Resume: ${!!user.resume_text}`);
  console.log(`  Has Profile Digest: ${!!user.profile_digest}`);
  console.log(`  Tags: ${(user.tags || []).join(", ") || "None"}`);

  // 2. Infer target companies from profile via OpenAI
  console.log(`\n🤖 Inferring target companies from profile...`);

  const profileContext = [
    user.job_title ? `Current Role: ${user.job_title}` : "",
    user.company ? `Current Company: ${user.company}` : "",
    user.professional_bio ? `Bio: ${user.professional_bio}` : "",
    user.about ? `About: ${user.about}` : "",
    user.resume_text ? `Resume (first 3000 chars): ${user.resume_text.substring(0, 3000)}` : "",
    user.profile_digest?.skills ? `Skills: ${user.profile_digest.skills.join(", ")}` : "",
    user.profile_digest?.summary ? `Summary: ${user.profile_digest.summary}` : "",
    (user.tags || []).length > 0 ? `Tags: ${user.tags.join(", ")}` : "",
  ].filter(Boolean).join("\n");

  const inferPrompt = `You are a career advisor. Given this professional's profile, suggest 8–12 real companies in India (or with major India offices) that this person would likely want to apply to. Consider their current company, skills, experience level, and industry.

Profile:
${profileContext}

RULES:
- Return ONLY a JSON object with a "companies" key containing an array of company name strings
- Include a mix of similar-tier companies, aspirational companies, and companies in related domains
- Exclude the person's CURRENT company (${user.company || "unknown"})
- Focus on companies with significant India presence
- Use official company names (e.g., "Google" not "Alphabet", "Flipkart" not "Flipkart Internet Pvt Ltd")

Example: {"companies": ["Google", "Microsoft", "Flipkart", "Razorpay", "Swiggy"]}`;

  const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: inferPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
  });

  if (!oaiRes.ok) {
    console.error(`OpenAI API failed: ${oaiRes.status}`);
    process.exit(1);
  }

  const oaiData = await oaiRes.json();
  let inferredCompanies: string[] = [];

  try {
    const parsed = JSON.parse(oaiData.choices[0].message.content);
    inferredCompanies = parsed.companies || [];
  } catch (e) {
    console.error("Failed to parse OpenAI response:", oaiData.choices[0].message.content);
    process.exit(1);
  }

  console.log(`  Inferred ${inferredCompanies.length} target companies:`);
  inferredCompanies.forEach((c, i) => console.log(`    ${i + 1}. ${c}`));

  // 3. Resolve ATS for each company
  console.log(`\n🔧 Resolving ATS configurations...`);

  const results: Array<{
    company: string;
    provider: string;
    boardToken: string;
    careersUrl: string;
    source: string;
    status: string;
  }> = [];

  for (const companyName of inferredCompanies) {
    process.stdout.write(`  Checking ${companyName}... `);

    // 3a. Check global company_ats_config first
    const { data: globalConfig } = await supabase
      .from("company_ats_config")
      .select("*")
      .ilike("company_name", companyName)
      .maybeSingle();

    if (globalConfig && globalConfig.provider !== "none") {
      console.log(`✅ Found in company_ats_config (${globalConfig.provider})`);
      
      let careersUrl = "";
      if (globalConfig.provider === "greenhouse") {
        careersUrl = `https://boards.greenhouse.io/${globalConfig.board_token_or_url}`;
      } else if (globalConfig.provider === "lever") {
        careersUrl = `https://jobs.lever.co/${globalConfig.board_token_or_url}`;
      } else if (globalConfig.provider === "workday" || globalConfig.provider === "myworkdayjobs") {
        careersUrl = `https://${globalConfig.board_token_or_url}`;
      } else if (globalConfig.provider === "custom") {
        careersUrl = globalConfig.board_token_or_url;
      } else {
        careersUrl = globalConfig.board_token_or_url || "";
      }

      results.push({
        company: companyName,
        provider: globalConfig.provider,
        boardToken: globalConfig.board_token_or_url,
        careersUrl,
        source: "company_ats_config",
        status: "success",
      });
      continue;
    }

    // 3b. Run discoverAts() to auto-probe
    try {
      const ats = await discoverAts(companyName);
      if (ats) {
        console.log(`✅ Auto-discovered (${ats.provider})`);
        
        let careersUrl = "";
        if (ats.provider === "greenhouse") {
          careersUrl = `https://boards.greenhouse.io/${ats.board}`;
        } else if (ats.provider === "lever") {
          careersUrl = `https://jobs.lever.co/${ats.board}`;
        } else if (ats.provider === "workday") {
          careersUrl = `https://${ats.board}`;
        } else {
          careersUrl = ats.board;
        }

        results.push({
          company: companyName,
          provider: ats.provider,
          boardToken: ats.board,
          careersUrl,
          source: "auto-discovered",
          status: "success",
        });
      } else {
        console.log(`⏭️  No ATS found`);
        results.push({
          company: companyName,
          provider: "none",
          boardToken: "",
          careersUrl: "",
          source: "none",
          status: "no_ats",
        });
      }
    } catch (e: any) {
      console.log(`❌ Discovery error: ${e.message}`);
      results.push({
        company: companyName,
        provider: "none",
        boardToken: "",
        careersUrl: "",
        source: "error",
        status: "no_ats",
      });
    }

    // Polite delay between probes
    await new Promise((r) => setTimeout(r, 300));
  }

  // 4. Upsert ATS configurations into company_ats_config and associate with user
  console.log(`\n💾 Saving ${results.length} target companies to database...`);

  let savedCount = 0;
  const targetCompanyNames: string[] = [];

  for (const r of results) {
    targetCompanyNames.push(r.company);

    if (r.status === "success") {
      const { error } = await supabase.from("company_ats_config").upsert(
        {
          company_name: r.company,
          provider: r.provider,
          board_token_or_url: r.boardToken,
          scrape_notes: `Target company for user ${TARGET_USER_ID} (${r.source})`,
        },
        { onConflict: "company_name" }
      );

      if (error) {
        console.error(`  ❌ Failed to save ${r.company}: ${error.message}`);
      } else {
        savedCount++;
      }
    } else {
      savedCount++;
    }
  }

  // Save target company list into user's profile_digest
  const updatedDigest = {
    ...(user.profile_digest || {}),
    target_companies: targetCompanyNames,
    updated_at: new Date().toISOString(),
  };

  const { error: userUpdateErr } = await supabase
    .from("users")
    .update({ profile_digest: updatedDigest })
    .eq("id", TARGET_USER_ID);

  if (userUpdateErr) {
    console.error(`❌ Failed to update user profile_digest: ${userUpdateErr.message}`);
  } else {
    console.log(`✅ Updated target_companies array in user ${TARGET_USER_ID} profile_digest.`);
  }

  // 5. Print summary table
  console.log(`\n${"═".repeat(100)}`);
  console.log("TARGET COMPANIES SUMMARY");
  console.log(`${"═".repeat(100)}`);
  console.log(
    "Company".padEnd(25) +
    "Provider".padEnd(18) +
    "Careers URL".padEnd(45) +
    "Status".padEnd(12)
  );
  console.log("─".repeat(100));

  for (const r of results) {
    const urlDisplay = r.careersUrl
      ? r.careersUrl.length > 43
        ? r.careersUrl.substring(0, 40) + "..."
        : r.careersUrl
      : "—";

    console.log(
      r.company.padEnd(25) +
      r.provider.padEnd(18) +
      urlDisplay.padEnd(45) +
      (r.status === "success" ? "✅ Ready" : "⏭️ No ATS").padEnd(12)
    );
  }

  console.log("─".repeat(100));
  console.log(`\n✅ Saved ${savedCount}/${results.length} target companies for user ${TARGET_USER_ID}.`);
  console.log(`   Ready to scrape: ${results.filter(r => r.status === "success").length}`);
  console.log(`   No ATS found: ${results.filter(r => r.status === "no_ats").length}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

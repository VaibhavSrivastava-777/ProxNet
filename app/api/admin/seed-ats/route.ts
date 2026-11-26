import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyMappings } from "@/lib/anonymize";
import { getAdminSession } from "@/lib/admin-session";
import { discoverAts } from "@/lib/ats-discovery";
import { isSameCompany } from "@/lib/jobs/job-filters";

export async function GET(request: Request) {
  return handleRequest(request);
}

export async function POST(request: Request) {
  return handleRequest(request);
}

async function handleRequest(request: Request) {
  const authHeader = request.headers.get("authorization");
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isAdmin = await getAdminSession();

  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";
  const includeStatic = searchParams.get("all") === "true";

  if (force) {
    // Clear dynamically discovered configurations but preserve manual custom ones
    const { error: deleteError } = await supabase
      .from("company_ats_config")
      .delete()
      .neq("provider", "custom");
    if (deleteError) {
      return NextResponse.json({ error: `Failed to clear configs: ${deleteError.message}` }, { status: 500 });
    }
  }

  // 1. Fetch network companies and trim trailing spaces
  const { data: users, error: userError } = await supabase.from("users").select("company");
  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });

  const networkCompanies = Array.from(new Set(
    users
      .map(u => (u.company as string)?.trim())
      .filter((c): c is string => !!c)
  ));

  // 2. Determine target companies to seed (only network by default to avoid timeouts)
  const allCompanies = includeStatic
    ? Array.from(new Set([...networkCompanies, ...Object.keys(companyMappings)]))
    : networkCompanies;

  // 3. Fetch existing configurations to skip them
  const { data: existingConfigs, error: configsError } = await supabase
    .from("company_ats_config")
    .select("company_name, provider");
    
  if (configsError) return NextResponse.json({ error: configsError.message }, { status: 500 });

  const JUNK_COMPANY_TOKENS = new Set([
    "retired",
    "independent advisory practice",
    "ex tcs n tech mahindra , consulting",
    "proxnet",
    "motiveminds consulting pvt ltd",
    "t",
    "x",
    "self employed",
    "freelance",
    "none",
    "n/a",
    "na"
  ]);

  const validConfigs = (existingConfigs || []).filter(c => c.provider && c.provider !== "none" && c.provider !== "cron_status");
  const seededCompanies = new Set(
    existingConfigs.map(c => c.company_name.toLowerCase().trim())
  );

  // 4. Filter down to truly unseeded companies (not in DB, not an alias of an active board, not junk)
  const unseededCompanies = allCompanies.filter(c => {
    const lower = c.toLowerCase().trim();
    if (JUNK_COMPANY_TOKENS.has(lower) || lower.length <= 1) return false;
    if (seededCompanies.has(lower)) return false;
    if (validConfigs.some(vc => isSameCompany(c, vc.company_name))) return false;
    return true;
  });

  if (unseededCompanies.length === 0) {
    return NextResponse.json({
      success: true,
      message: force 
        ? "Purged configurations and successfully re-seeded statically known boards!"
        : "All network companies are already mapped to active ATS scrapers or verified as direct hiring!",
      seededCount: seededCompanies.size,
      remainingCount: 0
    });
  }

  // 5. Process in a batch (batch size 15 if network only, 5 if full static catalog)
  const batchSize = includeStatic ? 5 : 15;
  const batch = unseededCompanies.slice(0, batchSize);

  const results: string[] = [];
  let successCount = 0;

  for (const company of batch) {
    const cleanCompany = company.trim();
    const formattedName = cleanCompany.charAt(0).toUpperCase() + cleanCompany.slice(1);
    
    try {
      const ats = await discoverAts(cleanCompany);
      if (ats) {
        const { error } = await supabase
          .from("company_ats_config")
          .upsert({
            company_name: formattedName,
            provider: ats.provider,
            board_token_or_url: ats.board
          }, { onConflict: "company_name" });

        if (!error) {
          successCount++;
          results.push(`✅ ${formattedName} -> ${ats.provider}`);
        } else {
          results.push(`❌ Failed to save ${formattedName}: ${error.message}`);
        }
      } else {
        // Even if we don't find a public ATS board, we insert a placeholder config
        // under provider 'none' to avoid checking it again next time
        await supabase
          .from("company_ats_config")
          .upsert({
            company_name: formattedName,
            provider: "none",
            board_token_or_url: "none"
          }, { onConflict: "company_name" });

        results.push(`⏭️ No board found for ${formattedName} (marked to skip)`);
      }
    } catch (e: any) {
      results.push(`⚠️ Error processing ${formattedName}: ${e.message}`);
    }

    // Short delay to respect rate limits
    await new Promise(r => setTimeout(r, 100));
  }

  const remaining = unseededCompanies.length - batch.length;

  return NextResponse.json({
    success: true,
    message: `Processed a batch of ${batch.length} companies. Seeded: ${successCount}.`,
    results,
    remainingCount: remaining,
    hasMore: remaining > 0
  });
}

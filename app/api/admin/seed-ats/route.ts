import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyMappings } from "@/lib/anonymize";
import { getAdminSession } from "@/lib/admin-session";
import { discoverAts } from "@/lib/ats-discovery";

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
  
  // 1. Fetch network companies
  const { data: users, error: userError } = await supabase.from("users").select("company");
  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });

  const networkCompanies = Array.from(new Set(
    users.map(u => u.company).filter(c => c && c.trim() !== "")
  ));

  // 2. Combine with static catalog
  const staticCompanies = Object.keys(companyMappings);
  const allCompanies = Array.from(new Set([...networkCompanies, ...staticCompanies]));

  // 3. Fetch existing configurations to skip them
  const { data: existingConfigs, error: configsError } = await supabase
    .from("company_ats_config")
    .select("company_name");
    
  if (configsError) return NextResponse.json({ error: configsError.message }, { status: 500 });

  const seededCompanies = new Set(
    existingConfigs.map(c => c.company_name.toLowerCase().trim())
  );

  // 4. Filter down to unseeded companies
  const unseededCompanies = allCompanies.filter(
    c => !seededCompanies.has(c.toLowerCase().trim())
  );

  if (unseededCompanies.length === 0) {
    return NextResponse.json({
      success: true,
      message: "All companies (network + static) are already seeded!",
      seededCount: seededCompanies.size,
      remainingCount: 0
    });
  }

  // 5. Process in a small batch of 5 to avoid Vercel timeouts
  const batchSize = 5;
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

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
  
  const { data: users, error: userError } = await supabase.from("users").select("company");
  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });

  const networkCompanies = new Set(
    users.map(u => u.company).filter(c => c && c.trim() !== "")
  );

  const staticCompanies = Object.keys(companyMappings);
  const allCompanies = new Set([...networkCompanies, ...staticCompanies]);

  let successCount = 0;
  let skipCount = 0;
  const results = [];

  for (const company of allCompanies) {
    const cleanCompany = typeof company === "string" ? company.trim() : "";
    if (!cleanCompany) continue;

    const formattedName = cleanCompany.charAt(0).toUpperCase() + cleanCompany.slice(1);
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
      }
    } else {
      skipCount++;
    }
  }

  return NextResponse.json({
    success: true,
    message: `Seeded ${successCount} ATS configs. Skipped ${skipCount}.`,
    results
  });
}

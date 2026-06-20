import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyMappings } from "@/lib/anonymize";
import { getAdminSession } from "@/lib/admin-session";

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
  let guess = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
  
  if (guess === "notion") guess = "notionhq";
  if (guess === "ola") guess = "olacabs";

  try {
    const leverRes = await fetchWithTimeout(`https://api.lever.co/v0/postings/${guess}?mode=json`);
    if (leverRes.ok) {
      const data = await leverRes.json();
      if (Array.isArray(data)) return { provider: "lever", board: guess };
    }
  } catch (e) {}

  try {
    const ghRes = await fetchWithTimeout(`https://boards-api.greenhouse.io/v1/boards/${guess}/jobs?content=true`);
    if (ghRes.ok) {
      const data = await ghRes.json();
      if (data && data.jobs) return { provider: "greenhouse", board: guess };
    }
  } catch (e) {}

  return null;
}

export async function POST(request: Request) {
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

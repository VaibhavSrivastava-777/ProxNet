import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const isAdmin = await getAdminSession();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  
  // Get all existing configs
  const { data: configs, error: configError } = await supabase
    .from("company_ats_config")
    .select("*")
    .order("created_at", { ascending: false });
  
  if (configError) return NextResponse.json({ error: configError.message }, { status: 500 });

  // Extract cron status and filter it out of standard configs
  const cronStatusConfig = (configs || []).find(c => c.provider === "cron_status");
  const filteredConfigs = (configs || []).filter(c => c.provider !== "cron_status");
  
  let cronStatus = null;
  if (cronStatusConfig) {
    try {
      cronStatus = JSON.parse(cronStatusConfig.board_token_or_url);
    } catch (e) {}
  }

  // Get all unique companies from users
  const { data: users, error: userError } = await supabase
    .from("users")
    .select("company")
    .not("company", "is", null);

  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });

  // Compute available companies (ignoring system status row)
  const configuredCompanies = new Set(filteredConfigs.map(c => c.company_name.toLowerCase().trim()));
  
  const allCompanies = Array.from(new Set(
    (users || [])
      .map(u => (u.company as string).trim())
      .filter(Boolean)
  )).sort();

  const availableCompanies = allCompanies.filter(c => !configuredCompanies.has(c.toLowerCase()));

  return NextResponse.json({ configs: filteredConfigs, availableCompanies, cronStatus });
}


export async function POST(request: Request) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let { company_name, provider, board_token_or_url } = await request.json();
  if (!company_name) {
    return NextResponse.json({ error: "Missing company_name" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Auto-discovery if provider and board token are not provided
  if (!provider && !board_token_or_url) {
    try {
      const { discoverAts } = await import("@/lib/ats-discovery");
      const discovery = await discoverAts(company_name);
      if (!discovery) {
        return NextResponse.json({ error: `Could not auto-discover ATS strategy for "${company_name}"` }, { status: 404 });
      }
      provider = discovery.provider;
      board_token_or_url = discovery.board;
    } catch (e: any) {
      return NextResponse.json({ error: `ATS discovery error: ${e.message}` }, { status: 500 });
    }
  }

  // Auto-Detect logic from sample URL
  if (provider === "custom") {
    try {
      const urlObj = new URL(board_token_or_url);
      const hostname = urlObj.hostname.toLowerCase();
      
      if (hostname.includes("greenhouse.io")) {
        provider = "greenhouse";
        // e.g. https://boards.greenhouse.io/figma/jobs/123 -> figma
        const parts = urlObj.pathname.split("/").filter(Boolean);
        board_token_or_url = parts[0] || "";
      } else if (hostname.includes("lever.co")) {
        provider = "lever";
        // e.g. https://jobs.lever.co/netflix/123 -> netflix
        const parts = urlObj.pathname.split("/").filter(Boolean);
        board_token_or_url = parts[0] || "";
      } else {
        // Leave provider as "custom" and board_token_or_url as the full URL
        // We will parse this single URL via AI during the scraping phase.
      }
      
      if (!board_token_or_url) {
        return NextResponse.json({ error: "Could not extract board token from the provided URL." }, { status: 400 });
      }
    } catch (e) {
      return NextResponse.json({ error: "Invalid URL provided for custom detection." }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from("company_ats_config")
    .insert({ company_name, provider, board_token_or_url })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}

export async function DELETE(request: Request) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("company_ats_config").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

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

  // Get all unique companies from users
  const { data: users, error: userError } = await supabase
    .from("users")
    .select("company")
    .not("company", "is", null);

  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });

  // Compute available companies
  const configuredCompanies = new Set((configs || []).map(c => c.company_name.toLowerCase().trim()));
  
  const allCompanies = Array.from(new Set(
    (users || [])
      .map(u => (u.company as string).trim())
      .filter(Boolean)
  )).sort();

  const availableCompanies = allCompanies.filter(c => !configuredCompanies.has(c.toLowerCase()));

  return NextResponse.json({ configs, availableCompanies });
}

export async function POST(request: Request) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { company_name, provider, board_token_or_url } = await request.json();
  if (!company_name || !provider || !board_token_or_url) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createAdminClient();
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

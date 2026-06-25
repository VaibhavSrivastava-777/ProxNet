import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== "inspect_998877") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const { data: users, error: userError } = await supabase.from("users").select("company, full_name, email");
    if (userError) throw new Error(userError.message);

    const { data: configs, error: configError } = await supabase.from("company_ats_config").select("*");
    if (configError) throw new Error(configError.message);

    const networkCompanies = Array.from(new Set(
      users.map(u => u.company).filter(c => c && c.trim() !== "")
    ));

    return NextResponse.json({
      success: true,
      networkCompanies,
      users: users.map(u => ({ name: u.full_name, email: u.email, company: u.company })),
      configs: configs.map(c => ({ company: c.company_name, provider: c.provider, board: c.board_token_or_url }))
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

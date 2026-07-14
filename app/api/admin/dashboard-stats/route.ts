import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const [
      { count: totalUsers },
      { count: totalJobs },
      { count: totalCarpools },
      { data: configs }
    ] = await Promise.all([
      supabase.from("users").select("*", { head: true, count: "exact" }),
      supabase.from("scraped_jobs").select("*", { head: true, count: "exact" }),
      supabase.from("carpool_posts").select("*", { head: true, count: "exact" }),
      supabase.from("company_ats_config").select("provider")
    ]);

    const totalConfigs = configs?.length || 0;
    const mappedConfigs = configs?.filter(c => c.provider && c.provider !== "none").length || 0;
    const unmappedConfigs = totalConfigs - mappedConfigs;

    return NextResponse.json({
      users: totalUsers || 0,
      jobs: totalJobs || 0,
      carpools: totalCarpools || 0,
      ats: {
        total: totalConfigs,
        mapped: mappedConfigs,
        unmapped: unmappedConfigs
      }
    });
  } catch (err: any) {
    console.error("Failed to fetch dashboard stats:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

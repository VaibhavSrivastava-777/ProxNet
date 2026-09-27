import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createAdminClient } from "../lib/supabase/admin";

async function main() {
  const supabase = createAdminClient();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    { count: totalUsers },
    { count: activeUsers },
    { count: blockedUsers },
    { data: usersMissingEmbeddings },
    { data: usersList },
    { count: totalJobs },
    { count: freshJobs },
    { count: totalCarpools },
    { data: atsConfigs }
  ] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("is_blocked", true),
    supabase.from("users").select("id").is("embedding", null).eq("is_active", true),
    supabase.from("users").select("id, full_name, email, company, job_title, home_lat, home_lng, home_name, office_lat, office_lng, office_name"),
    supabase.from("scraped_jobs").select("*", { count: "exact", head: true }),
    supabase.from("scraped_jobs").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo.toISOString()),
    supabase.from("carpool_posts").select("*", { count: "exact", head: true }),
    supabase.from("company_ats_config").select("company_name, provider, total_jobs_found, last_scraped_at")
  ]);

  let incompleteProfiles = 0;
  let missingGeocodes = 0;
  const userCompanies = new Set<string>();

  for (const u of (usersList || [])) {
    if (u.company) userCompanies.add(u.company.trim().toLowerCase());
    const isProfileIncomplete = !u.full_name?.trim() || !u.company?.trim() || !u.job_title?.trim() || !u.email?.trim();
    if (isProfileIncomplete) incompleteProfiles++;

    const hasHomeCoords = u.home_lat && u.home_lng;
    const hasOfficeCoords = u.office_lat && u.office_lng;
    const homeNeedsGeocode = hasHomeCoords && (!u.home_name || u.home_name.toLowerCase() === "home" || u.home_name.toLowerCase() === "office");
    const officeNeedsGeocode = hasOfficeCoords && (!u.office_name || u.office_name.toLowerCase() === "home" || u.office_name.toLowerCase() === "office");
    if (homeNeedsGeocode || officeNeedsGeocode) missingGeocodes++;
  }

  const validAtsConfigs = (atsConfigs || []).filter(c => c.provider !== "cron_status" && c.provider !== "none");
  const configuredCompanies = new Set(validAtsConfigs.map(c => c.company_name.trim().toLowerCase()));

  let unmappedNetworkCompanies = 0;
  for (const c of userCompanies) {
    if (!configuredCompanies.has(c)) unmappedNetworkCompanies++;
  }

  console.log("=== LEADING INDICATORS DIAGNOSIS ===");
  console.log("Total Users:", totalUsers);
  console.log("Active Users:", activeUsers);
  console.log("Blocked Users:", blockedUsers);
  console.log("Users Missing Embeddings:", usersMissingEmbeddings?.length || 0);
  console.log("Incomplete Profiles:", incompleteProfiles);
  console.log("Users Needing Geocoding:", missingGeocodes);
  console.log("Total Scraped Jobs:", totalJobs);
  console.log("Fresh Jobs (last 7d):", freshJobs);
  console.log("Unique User Companies:", userCompanies.size);
  console.log("Valid ATS Configs:", validAtsConfigs.length);
  console.log("Unmapped Network Companies:", unmappedNetworkCompanies);
  console.log("Total Carpools:", totalCarpools);
}

main().catch(console.error);

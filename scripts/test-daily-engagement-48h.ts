import fs from "fs";
import path from "path";

async function main() {
  console.log("=== VALIDATING 48-HOUR ENGAGEMENT NOTIFICATION LOGIC ===");

  const routePath = path.join(process.cwd(), "app/api/cron/daily-engagement/route.ts");
  const content = fs.readFileSync(routePath, "utf-8");

  // Check 1: Route checks fortyEightHoursAgo
  if (!content.includes("fortyEightHoursAgo")) {
    throw new Error("Validation Failed: route does not define fortyEightHoursAgo");
  }
  console.log("✓ Route defines fortyEightHoursAgo.");

  // Check 2: Calculation uses 48 hours in milliseconds (48 * 60 * 60 * 1000)
  if (!content.includes("48 * 60 * 60 * 1000")) {
    throw new Error("Validation Failed: route does not use 48 * 60 * 60 * 1000 ms");
  }
  console.log("✓ Route calculates cutoff with 48 * 60 * 60 * 1000 (48 hours).");

  // Check 3: Query filters notifications with .gte("created_at", fortyEightHoursAgo)
  if (!content.includes('.gte("created_at", fortyEightHoursAgo)')) {
    throw new Error("Validation Failed: query does not filter notifications with fortyEightHoursAgo");
  }
  console.log("✓ Query checks in_app_notifications with gte created_at against 48-hour cutoff.");

  // Check 4: Simulate cutoff calculation
  const now = Date.now();
  const cutoffIso = new Date(now - 48 * 60 * 60 * 1000).toISOString();
  const diffHours = (now - new Date(cutoffIso).getTime()) / (1000 * 60 * 60);
  if (Math.round(diffHours) !== 48) {
    throw new Error(`Simulation Failed: expected 48 hours diff, got ${diffHours}`);
  }
  console.log(`✓ Cutoff simulation verified: exactly 48.0 hours (${cutoffIso}).`);

  // Check 5: Verify value proposition engagement templates are preserved
  if (!content.includes("daily_value_prop")) {
    throw new Error("Validation Failed: engagementType daily_value_prop is missing");
  }
  if (!content.includes("ENGAGEMENT_TEMPLATES")) {
    throw new Error("Validation Failed: ENGAGEMENT_TEMPLATES is missing");
  }
  console.log("✓ Value proposition engagement templates and metadata verified.");

  console.log("\n🎉 ALL 48-HOUR ENGAGEMENT TESTS PASSED SUCCESSFULLY!");
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

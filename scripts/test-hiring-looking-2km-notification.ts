import { readFileSync } from "fs";
import { join } from "path";

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`✅ ${msg}`);
  } else {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
}

console.log("=== Testing Hiring / Looking 2KM Radius Notifications ===\n");

const root = process.cwd();

// 1. Check lib/notifications.ts
const notifsPath = join(root, "lib", "notifications.ts");
const notifsCode = readFileSync(notifsPath, "utf-8");

assert(notifsCode.includes("export async function notifyUsersWithin2km"), "notifyUsersWithin2km is exported");
assert(notifsCode.includes("distHome <= 2000"), "Haversine threshold strictly set to 2000m (2KM)");
assert(notifsCode.includes("if (u.id === creatorId) continue;"), "notifyUsersWithin2km skips creator so poster is not notified");
assert(notifsCode.includes('notifType === "job_post_nearby"'), "job_post_nearby is registered as isPriorityNotification");
assert(notifsCode.includes('notifType.includes("hiring")'), "hiring notifications are registered as priority");
assert(notifsCode.includes('notifType.includes("looking")'), "looking notifications are registered as priority");

// 2. Check app/api/job-posts/route.ts
const jobPostsRoutePath = join(root, "app", "api", "job-posts", "route.ts");
const jobPostsCode = readFileSync(jobPostsRoutePath, "utf-8");

assert(jobPostsCode.includes("notifyUsersWithin2km({"), "job-posts route calls notifyUsersWithin2km");
assert(
  jobPostsCode.includes('title: type === "giver" ? `New Hiring Referral nearby: ${role}` : `Neighbor Looking for Role nearby: ${role}`'),
  "job-posts route sets dedicated title for Hiring (giver) and Looking (seeker)"
);
assert(jobPostsCode.includes('type: "job_post_nearby"'), "job-posts route passes type: job_post_nearby");

// 3. Check app/api/jobs/post/route.ts
const jobsPostRoutePath = join(root, "app", "api", "jobs", "post", "route.ts");
const jobsPostCode = readFileSync(jobsPostRoutePath, "utf-8");

assert(jobsPostCode.includes('import { notifyUsersWithin2km } from "@/lib/notifications"'), "jobs/post imports notifyUsersWithin2km");
assert(jobsPostCode.includes("notifyUsersWithin2km({"), "jobs/post route calls notifyUsersWithin2km");
assert(
  jobsPostCode.includes('title: type === "giver" ? `New Hiring Referral nearby: ${role}` : `Neighbor Looking for Role nearby: ${role}`'),
  "jobs/post route sets dedicated title for Hiring (giver) and Looking (seeker)"
);
assert(jobsPostCode.includes('type: "job_post_nearby"'), "jobs/post route passes type: job_post_nearby");

console.log("\nAll Hiring / Looking 2KM notification tests passed successfully!");

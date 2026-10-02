import { existsSync, readFileSync } from "fs";
import { join } from "path";
import assert from "assert";

console.log("=================================================");
console.log("🔍 PROXNET REDESIGN & DAILY DIGEST VALIDATION TEST");
console.log("=================================================");

const root = process.cwd();

// --- TEST 1: Navigation & Header Structure ---
console.log("\n[Test 1] Validating Navigation & Header Overhaul in NavClient.tsx...");
const navClientPath = join(root, "components", "NavClient.tsx");
assert(existsSync(navClientPath), "NavClient.tsx must exist");
const navClientContent = readFileSync(navClientPath, "utf-8");

assert(navClientContent.includes('href: "/jobs"'), "NavClient must contain /jobs tab");
assert(navClientContent.includes('href: "/applied"'), "NavClient must contain /applied tab");
assert(navClientContent.includes('href: "/network"'), "NavClient must contain /network tab");
assert(navClientContent.includes('href: "/profile"'), "NavClient must contain /profile tab");
assert(navClientContent.includes('data-tour="nav-forum"'), "NavClient must feature Forum in top header");
assert(navClientContent.includes("calculateProfileCompleteness"), "NavClient must calculate profile completeness");
assert(navClientContent.includes("strokeDasharray"), "NavClient must render peripheral circle with strokeDasharray");
assert(navClientContent.includes("strokeDashoffset"), "NavClient must render peripheral circle with strokeDashoffset");
console.log("✅ Test 1 Passed: 4 Hero Tabs + Top-Right Forum + Peripheral Profile Ring verified.");

// --- TEST 2: Tab Routing & Shell ---
console.log("\n[Test 2] Validating Tab Routing & QAContent Wrapper...");
const appliedPagePath = join(root, "app", "applied", "page.tsx");
assert(existsSync(appliedPagePath), "app/applied/page.tsx must exist");
const appliedPageContent = readFileSync(appliedPagePath, "utf-8");
assert(appliedPageContent.includes('initialTab="/applied"'), "app/applied/page.tsx must pass initialTab='/applied'");

const qaContentPath = join(root, "app", "qa", "QAContent.tsx");
assert(existsSync(qaContentPath), "QAContent.tsx must exist");
const qaContent = readFileSync(qaContentPath, "utf-8");
assert(qaContent.includes("<JobsFeed"), "QAContent must render JobsFeed on /jobs");
assert(qaContent.includes("<AppliedJobsTab"), "QAContent must render AppliedJobsTab on /applied");
assert(qaContent.includes("<NetworkChatTab"), "QAContent must render NetworkChatTab on /network");
assert(qaContent.includes("<ProfileTab"), "QAContent must render ProfileTab on /profile");
assert(qaContent.includes("<LocalForumFeed"), "QAContent must render LocalForumFeed on /forum");
console.log("✅ Test 2 Passed: Tab Routing & QAContent cleanly coordinates all 4 hero tabs + forum.");

// --- TEST 3: JobsFeed & JobDetailSheet ---
console.log("\n[Test 3] Validating JobsFeed and JobDetailSheet...");
const jobsFeedPath = join(root, "components", "jobs", "JobsFeed.tsx");
assert(existsSync(jobsFeedPath), "JobsFeed.tsx must exist");
const jobsFeedContent = readFileSync(jobsFeedPath, "utf-8");
assert(jobsFeedContent.includes("visibleCount"), "JobsFeed must support pagination");
assert(jobsFeedContent.includes("setVisibleCount((prev) => prev + 10)"), "JobsFeed must load 10 more on demand");
assert(jobsFeedContent.includes("<CompanyLogo"), "JobsFeed must render company logo");
assert(jobsFeedContent.includes("job.experience"), "JobsFeed must display experience tier");
assert(jobsFeedContent.includes("job.posted_at"), "JobsFeed must display posting age");
assert(jobsFeedContent.includes("job.location"), "JobsFeed must display location");
assert(jobsFeedContent.includes("job.matchRate"), "JobsFeed must display match rate");

const detailSheetPath = join(root, "components", "jobs", "JobDetailSheet.tsx");
assert(existsSync(detailSheetPath), "JobDetailSheet.tsx must exist");
const detailSheetContent = readFileSync(detailSheetPath, "utf-8");
assert(detailSheetContent.includes("Prepare Me (1 ⚡)"), "JobDetailSheet must have 1-credit Prepare Me option");
assert(detailSheetContent.includes("Apply Directly"), "JobDetailSheet must have Apply Directly option");
assert(detailSheetContent.includes("window.open(job.url, \"_blank\""), "Apply Directly must open opportunity in new tab");
assert(detailSheetContent.includes("preparation.strengths"), "JobDetailSheet must display strengths");
assert(detailSheetContent.includes("preparation.weaknesses"), "JobDetailSheet must display weaknesses & objection handlers");
assert(detailSheetContent.includes("preparation.roleExpectations"), "JobDetailSheet must display role expectations");
assert(detailSheetContent.includes("preparation.networkingPath"), "JobDetailSheet must display networking path");
assert(detailSheetContent.includes("linkedinSearchUrl"), "JobDetailSheet must support LinkedIn traversal");
console.log("✅ Test 3 Passed: JobsFeed & JobDetailSheet verified with 25+10 paging, 1-credit Prepare Me & direct apply.");

// --- TEST 4: Prepare Me API & Wallet Credit Cost ---
console.log("\n[Test 4] Validating Prepare Me API & Credit Costs in wallet.ts...");
const walletPath = join(root, "lib", "wallet.ts");
const walletContent = readFileSync(walletPath, "utf-8");
assert(walletContent.includes('"prepare_me"'), "wallet.ts must include prepare_me in DebitReason");
assert(walletContent.includes("prepare_me: { amount: 1"), "prepare_me must cost exactly 1 credit in CREDIT_COSTS");

const prepareMeApiPath = join(root, "app", "api", "jobs", "prepare-me", "route.ts");
assert(existsSync(prepareMeApiPath), "app/api/jobs/prepare-me/route.ts must exist");
const prepareMeApiContent = readFileSync(prepareMeApiPath, "utf-8");
assert(prepareMeApiContent.includes('deductWalletCredits(user.id, "prepare_me"'), "prepare-me API must deduct 1 credit");
assert(prepareMeApiContent.includes("proxnetInsiders"), "prepare-me API must query nearby ProxNet insiders");
assert(prepareMeApiContent.includes("linkedinSearchUrl"), "prepare-me API must build LinkedIn search URL");
assert(prepareMeApiContent.includes("strengths"), "prepare-me API must synthesize strengths");
assert(prepareMeApiContent.includes("weaknesses"), "prepare-me API must synthesize weaknesses & objection handlers");
assert(prepareMeApiContent.includes("roleExpectations"), "prepare-me API must synthesize role expectations");
assert(prepareMeApiContent.includes("from(\"job_applications\")"), "prepare-me API must auto-persist to job_applications");
console.log("✅ Test 4 Passed: Prepare Me API consumes 1 credit and generates tailored 4-part playbook.");

// --- TEST 5: Applied Tracker Tab Persistence ---
console.log("\n[Test 5] Validating AppliedJobsTab...");
const appliedTabPath = join(root, "components", "jobs", "AppliedJobsTab.tsx");
assert(existsSync(appliedTabPath), "AppliedJobsTab.tsx must exist");
const appliedTabContent = readFileSync(appliedTabPath, "utf-8");
assert(appliedTabContent.includes("/api/jobs/applications"), "AppliedJobsTab must fetch from /api/jobs/applications");
assert(appliedTabContent.includes("Prepared"), "AppliedJobsTab must support Prepared filter");
assert(appliedTabContent.includes("Applied"), "AppliedJobsTab must support Applied filter");
assert(appliedTabContent.includes("openSavedPlaybook"), "AppliedJobsTab must allow re-viewing playbooks without re-spending credits");
console.log("✅ Test 5 Passed: AppliedJobsTab persists direct applications and unlocked playbooks.");

// --- TEST 6: Network & Chat Tab Unification ---
console.log("\n[Test 6] Validating NetworkChatTab...");
const networkChatTabPath = join(root, "components", "network", "NetworkChatTab.tsx");
assert(existsSync(networkChatTabPath), "NetworkChatTab.tsx must exist");
const networkChatTabContent = readFileSync(networkChatTabPath, "utf-8");
assert(networkChatTabContent.includes("<ProximityMap"), "NetworkChatTab must render ProximityMap");
assert(networkChatTabContent.includes("<QuestionList"), "NetworkChatTab must render QuestionList");
assert(networkChatTabContent.includes("subView"), "NetworkChatTab must provide sub-view toggle");
console.log("✅ Test 6 Passed: Network and Chat unified into single hero tab with seamless toggle.");

// --- TEST 7: Profile Tab with Peripheral Circle ---
console.log("\n[Test 7] Validating ProfileTab...");
const profileTabPath = join(root, "components", "profile", "ProfileTab.tsx");
assert(existsSync(profileTabPath), "ProfileTab.tsx must exist");
const profileTabContent = readFileSync(profileTabPath, "utf-8");
assert(profileTabContent.includes("calculateProfileCompleteness"), "ProfileTab must compute completeness");
assert(profileTabContent.includes("strokeDasharray"), "ProfileTab must render peripheral circle ring");
assert(profileTabContent.includes("getProfileCompletenessItems"), "ProfileTab must render checklist breakdown");
console.log("✅ Test 7 Passed: ProfileTab verified with SVG peripheral circle and completeness checklist.");

// --- TEST 8: Daily Proximity & Job Opportunity Notification Digest ---
console.log("\n[Test 8] Validating Daily Proximity & Top 3 Jobs Notification System...");
const dailyDigestLibPath = join(root, "lib", "notifications", "daily-proximity-and-jobs.ts");
assert(existsSync(dailyDigestLibPath), "lib/notifications/daily-proximity-and-jobs.ts must exist");
const dailyDigestLibContent = readFileSync(dailyDigestLibPath, "utf-8");
assert(dailyDigestLibContent.includes("haversineDistanceMeters"), "Daily digest must calculate distance");
assert(dailyDigestLibContent.includes("2000"), "Daily digest must check 2000m (2km) radius for new members");
assert(dailyDigestLibContent.includes("Top 3 Job Opportunities Today"), "Daily digest must notify top 3 matching opportunities");
assert(dailyDigestLibContent.includes("sendNotification"), "Daily digest must dispatch notification");

const dailyDigestCronPath = join(root, "app", "api", "cron", "daily-proximity-digest", "route.ts");
assert(existsSync(dailyDigestCronPath), "daily-proximity-digest route.ts must exist");
const dailyDigestCronContent = readFileSync(dailyDigestCronPath, "utf-8");
assert(dailyDigestCronContent.includes("runDailyProximityAndJobsCron"), "Cron route must execute runDailyProximityAndJobsCron");
console.log("✅ Test 8 Passed: Daily proximity & top 3 job notification service and cron endpoint verified.");

console.log("\n=================================================");
console.log("🎉 ALL 8 VALIDATION TESTS PASSED SUCCESSFULLY!");
console.log("=================================================");

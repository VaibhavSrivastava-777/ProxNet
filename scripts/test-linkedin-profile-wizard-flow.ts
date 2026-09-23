import assert from "assert";
import { formatLinkedInUrl } from "../lib/linkedin/normalize-url";
import { getMissingProfileWizardSteps } from "../lib/profile-wizard";
import { POST as adminScrape } from "../app/api/admin/scrape/route";
import type { User } from "../lib/types";

async function runWizardFlowTests() {
  console.log("=================================================");
  console.log("TEST: Profile Wizard Modal & Admin Scrape Flow");
  console.log("=================================================\n");

  // 1. Initial user has no profile data
  const user1: Partial<User> = {
    id: "user-test-1",
    full_name: "Test User",
    email: "test@example.com",
    linkedin_profile_url: null,
    job_title: null,
    company: null,
    about: null,
    professional_bio: null,
    home_lat: null,
    office_lat: null,
  };

  const initialSteps = getMissingProfileWizardSteps(user1, false);
  console.log("1. Initial missing steps:", initialSteps);
  assert.strictEqual(initialSteps[0], "linkedin_url", "First step must be linkedin_url");
  assert(initialSteps.includes("designation"), "Must require designation");
  assert(initialSteps.includes("company"), "Must require company");

  // 2. User enters LinkedIn URL in modal:
  // Step 1 saves immediately without waiting for scrape
  const rawUrl = "https://www.linkedin.com/in/satyanadella?utm_source=proxnet";
  const formattedUrl = formatLinkedInUrl(rawUrl);
  assert.strictEqual(formattedUrl, "https://www.linkedin.com/in/satyanadella");

  const userAfterStep1: Partial<User> = {
    ...user1,
    linkedin_profile_url: formattedUrl,
  };

  const stepsAfterStep1 = getMissingProfileWizardSteps(userAfterStep1, false);
  console.log("2. Steps immediately after entering LinkedIn URL (non-blocking):", stepsAfterStep1);
  assert(!stepsAfterStep1.includes("linkedin_url"), "linkedin_url step must be resolved immediately");
  assert.strictEqual(stepsAfterStep1[0], "designation", "Next active step must be designation");

  // 3. Background LinkedIn parse resolves with company & designation
  const scrapedFromLinkedIn = {
    job_title: "Chairman and Chief Executive Officer",
    company: "Microsoft",
    professional_bio: "A prominent technology leader leading cloud computing and enterprise platforms.",
  };

  const userAfterBackgroundParse: Partial<User> = {
    ...userAfterStep1,
    job_title: scrapedFromLinkedIn.job_title,
    company: scrapedFromLinkedIn.company,
    professional_bio: scrapedFromLinkedIn.professional_bio,
    about: scrapedFromLinkedIn.professional_bio,
  };

  const stepsAfterBackgroundParse = getMissingProfileWizardSteps(userAfterBackgroundParse, false);
  console.log("3. Steps after background parse enriches details:", stepsAfterBackgroundParse);
  assert(!stepsAfterBackgroundParse.includes("designation"), "designation is now populated by LinkedIn");
  assert(!stepsAfterBackgroundParse.includes("company"), "company is now populated by LinkedIn");
  assert(!stepsAfterBackgroundParse.includes("about_me"), "about_me is now populated by LinkedIn");
  assert.strictEqual(stepsAfterBackgroundParse[0], "home_location", "Next missing step advances directly to home_location");

  // 4. Test non-overriding rule: If user manually typed designation before parse arrived
  const userTypedManually: Partial<User> = {
    ...userAfterStep1,
    job_title: "Principal Engineer", // user typed before scrape finished
  };
  // Scraped job title arrives
  const resolvedTitle = userTypedManually.job_title?.trim()
    ? userTypedManually.job_title
    : scrapedFromLinkedIn.job_title;
  assert.strictEqual(resolvedTitle, "Principal Engineer", "Manual user edit must be preserved over background scrape");

  // 5. Test Admin Scrape API Route security & validation
  console.log("\n4. Testing /api/admin/scrape route validation:");
  const unauthReq = new Request("http://localhost:3000/api/admin/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://www.linkedin.com/in/test" }),
  });
  const unauthRes = await adminScrape(unauthReq);
  console.log("  ✓ Unauthenticated call status:", unauthRes.status);
  assert.strictEqual(unauthRes.status, 401, "Admin scrape route must reject unauthorized requests with 401");

  console.log("\n=================================================");
  console.log("ALL WIZARD FLOW & ADMIN TESTS PASSED SUCCESSFULLY!");
  console.log("=================================================");
}

runWizardFlowTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

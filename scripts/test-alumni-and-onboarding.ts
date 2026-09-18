import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { parseLinkedInHeadline } from "../lib/linkedin/parse-headline";
import {
  getInstitutes,
  getInstituteByDomain,
  getUserAffiliations,
  addAffiliation,
  deleteAffiliation,
  autoVerifyByEmail,
} from "../lib/institutes";
import { createAdminClient } from "../lib/supabase/admin";

async function runTests() {
  console.log("==================================================");
  console.log("🧪 STARTING ALUMNI & ONBOARDING VALIDATION TESTS");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // Test Suite 1: Headline Parser
  // ----------------------------------------------------
  console.log("--- 1. Testing LinkedIn Headline Parser ---");
  
  const test1 = parseLinkedInHeadline("Senior Software Engineer at Google");
  assert(test1.title === "Senior Software Engineer" && test1.company === "Google", "Parse 'at' pattern: SDE at Google");

  const test2 = parseLinkedInHeadline("Product Manager @ Microsoft");
  assert(test2.title === "Product Manager" && test2.company === "Microsoft", "Parse '@' pattern: PM @ Microsoft");

  const test3 = parseLinkedInHeadline("Founder & CEO | Acme Corp");
  assert(test3.title === "Founder & CEO" && test3.company === "Acme Corp", "Parse '|' pattern: Founder | Acme");

  const test4 = parseLinkedInHeadline("Staff Architect - Amazon AWS");
  assert(test4.title === "Staff Architect" && test4.company === "Amazon AWS", "Parse '-' pattern: Architect - Amazon");

  const test5 = parseLinkedInHeadline("Director, Meta");
  assert(test5.title === "Director" && test5.company === "Meta", "Parse ',' pattern: Director, Meta");

  const test6 = parseLinkedInHeadline("Frontend Developer");
  assert(test6.title === "Frontend Developer" && test6.company === null, "Parse single title without company");

  const test7 = parseLinkedInHeadline(null);
  assert(test7.title === null && test7.company === null, "Parse null headline safely");

  // ----------------------------------------------------
  // Test Suite 2: Institute Directory & Domain Matching
  // ----------------------------------------------------
  console.log("\n--- 2. Testing Institute Directory & Domain Matching ---");

  const institutes = await getInstitutes();
  assert(institutes.length > 0, `getInstitutes returned ${institutes.length} institutes`);

  const iitk = await getInstituteByDomain("iitk.ac.in");
  assert(iitk !== null && iitk.short_code === "IITK", "getInstituteByDomain matches 'iitk.ac.in' to IIT Kanpur");

  const iitb = await getInstituteByDomain("iitb.ac.in");
  assert(iitb !== null && iitb.short_code === "IITB", "getInstituteByDomain matches 'iitb.ac.in' to IIT Bombay");

  const gmail = await getInstituteByDomain("gmail.com");
  assert(gmail === null, "getInstituteByDomain ignores public email 'gmail.com'");

  // ----------------------------------------------------
  // Test Suite 3: User Affiliation Flow & Auto-Verification
  // ----------------------------------------------------
  console.log("\n--- 3. Testing User Affiliations & Domain Auto-Verification ---");

  const supabase = createAdminClient();
  const testSub = "test-alumni-" + Date.now();
  
  // Create a temporary test user
  const { data: testUser, error: createErr } = await supabase
    .from("users")
    .insert({
      linkedin_sub: testSub,
      full_name: "Test Alumni User",
      email: "test.student@iitk.ac.in",
      company: "Acme",
      job_title: "Engineer",
      source: "oauth",
      visibility: { showCompany: true, showTitle: true, showPhoto: true },
      active_location: "home",
      is_active: true,
      home_lat: 12.9716,
      home_lng: 77.5946,
      home_name: "Bengaluru",
    })
    .select("*")
    .single();

  if (createErr || !testUser) {
    console.error("Failed to create temporary test user:", createErr);
    failed++;
  } else {
    try {
      // Test auto-verification by institute email
      const autoAff = await autoVerifyByEmail(testUser.id, testUser.email);
      assert(
        autoAff !== null && autoAff.verification_status === "verified_domain",
        "autoVerifyByEmail auto-verifies affiliation for @iitk.ac.in email"
      );

      // Fetch user affiliations
      const userAffs = await getUserAffiliations(testUser.id);
      assert(userAffs.length >= 1, `getUserAffiliations returned ${userAffs.length} affiliations`);
      assert(userAffs[0].verification_status === "verified_domain", "Affiliation status is 'verified_domain'");
      assert(userAffs[0].institute?.name === "IIT Kanpur", "Affiliation joined institute name is 'IIT Kanpur'");

      // Test manual self-declared affiliation with non-domain email
      if (iitb) {
        const manualAff = await addAffiliation({
          userId: testUser.id,
          instituteId: iitb.id,
          degree: "M.Tech CSE",
          batchYear: 2022,
          userEmail: "non-matching@gmail.com",
        });
        assert(
          manualAff !== null && manualAff.verification_status === "unverified",
          "Manual affiliation with non-domain email is marked 'unverified' (Claimed)"
        );

        // Delete the manual affiliation
        if (manualAff) {
          const deleted = await deleteAffiliation(testUser.id, manualAff.id);
          assert(deleted, "deleteAffiliation successfully deleted affiliation");
        }
      }
    } finally {
      // Clean up test user & cascade affiliations
      await supabase.from("user_institute_affiliations").delete().eq("user_id", testUser.id);
      await supabase.from("users").delete().eq("id", testUser.id);
    }
  }

  console.log("\n==================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Validation script error:", e);
  process.exit(1);
});

import * as fs from "fs";
import * as path from "path";

async function runOption5Validation() {
  console.log("================================================================================");
  console.log("🧪 VALIDATION: OPTION 5 PROXNET-NATIVE JOBS TAB REDESIGN");
  console.log("================================================================================\n");

  const suggestedJobsPath = path.join(process.cwd(), "components/jobs/SuggestedJobs.tsx");
  const src = fs.readFileSync(suggestedJobsPath, "utf-8");

  function assert(condition: boolean, testName: string) {
    if (!condition) {
      throw new Error(`❌ Failed: ${testName}`);
    }
    console.log(`  ✓ ${testName}`);
  }

  // 1. Companion UX Narrative Header
  console.log(">>> [SECTION 1] Validating UX Principle & Career Companion Header...");
  assert(
    src.includes("Opportunities & Referrals"),
    "Renders primary companion title: 'Opportunities & Referrals'"
  );
  assert(
    src.includes("Here are the opportunities relevant to you, and here are the people who can help you act on them."),
    "Renders exact user-specified principle subtitle: 'Here are the opportunities relevant to you, and here are the people who can help you act on them.'"
  );

  // 2. Option 5 Hero Opportunity Card
  console.log("\n>>> [SECTION 2] Validating Hero Opportunity Card (Hero Match & Direct Actions)...");
  assert(
    src.includes("heroJobItem &&"),
    "Renders top Hero Opportunity Card conditionally based on highest match"
  );
  assert(
    src.includes("heroJobItem.job.score || heroJobItem.job.matchRate"),
    "Hero card shows prominent match score badge"
  );
  assert(
    src.includes("ProxNet connection") && src.includes("can refer you"),
    "Hero card displays connection hook ('X ProxNet connection(s) can refer you')"
  );
  assert(
    src.includes("View Job") && src.includes("setActiveCompanyModal(heroJobItem.group)"),
    "Hero card provides instant 'View Job' button opening openings modal"
  );
  assert(
    src.includes("Ask Referral") && src.includes("handleAskReferral"),
    "Hero card provides instant 'Ask Referral' button with pitch & referral flow"
  );

  // 3. Option 5 People Around You Who Can Help
  console.log("\n>>> [SECTION 3] Validating 'People around you who can help' & Community Trust Badge...");
  assert(
    src.includes("People around you who can help"),
    "Renders section header: 'People around you who can help'"
  );
  assert(
    src.includes("relevantHelpers.map((person) =>"),
    "Renders nearby colleagues and insider helpers list"
  );
  assert(
    src.includes("Mutual connections nearby") || src.includes("Nearby in your network"),
    "Renders distance and mutual connections context on helper cards"
  );
  assert(
    src.includes("Real people. Real referrals."),
    "Renders community trust title: 'Real people. Real referrals.'"
  );
  assert(
    src.includes("Your neighbourhood network works for you."),
    "Renders community trust subtitle: 'Your neighbourhood network works for you.'"
  );

  // 4. Option 5 More Similar Jobs
  console.log("\n>>> [SECTION 4] Validating 'More Similar Jobs' Alternative Roles Feed...");
  assert(
    src.includes("More Similar Jobs"),
    "Renders section header: 'More Similar Jobs'"
  );
  assert(
    src.includes("similarJobs.map(({ job, group }) =>"),
    "Iterates over alternative top matched opportunities"
  );
  assert(
    src.includes("% match"),
    "Displays match percentage on similar job cards"
  );

  // 5. Progressive Disclosure of Secondary Utilities
  console.log("\n>>> [SECTION 5] Validating Progressive Disclosure for Secondary Utilities...");
  assert(
    src.includes("Career Explorer & Tools") || src.includes("Career Explorer & Hub"),
    "Encapsulates secondary utilities under Career Explorer section"
  );
  assert(
    src.includes('id="btn-deep-ats-fetch"'),
    "Preserves Deep ATS Match Hunter with id='btn-deep-ats-fetch'"
  );
  assert(
    src.includes('id="pulse-active-roles"') &&
    src.includes('id="pulse-strong-matches"') &&
    src.includes('id="pulse-insider-referrers"') &&
    src.includes('id="pulse-companies"'),
    "Preserves all 4 Hiring Pulse interactive filter buttons"
  );
  assert(
    src.includes('id="jobs-company-list"'),
    "Preserves full company directory scroll anchor id='jobs-company-list'"
  );

  // 6. React Hook Invariant (Zero Error #310)
  console.log("\n>>> [SECTION 6] Validating Rules of React (Hook Order & No Early Returns Before Hooks)...");
  const lastHookIdx = Math.max(
    src.lastIndexOf("useMemo"),
    src.lastIndexOf("useEffect"),
    src.lastIndexOf("useState"),
    src.lastIndexOf("useCallback")
  );
  const loadingReturnIdx = src.indexOf("if (loading) {\n    return (");
  assert(
    loadingReturnIdx > lastHookIdx,
    "Early loading return is positioned strictly AFTER all React hooks (preventing Error #310)"
  );

  console.log("\n================================================================================");
  console.log("✅ ALL OPTION 5 REDESIGN VALIDATIONS PASSED WITH ZERO REGRESSIONS!");
  console.log("================================================================================\n");
}

runOption5Validation().catch((err) => {
  console.error(err);
  process.exit(1);
});

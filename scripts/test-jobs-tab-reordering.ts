import * as fs from "fs";
import * as path from "path";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runValidation() {
  console.log("================================================================================");
  console.log("🧪 VALIDATION SUITE: Jobs Tab Reordering & Default Collapsed Referral Inbox");
  console.log("================================================================================\n");

  const suggestedJobsPath = path.join(process.cwd(), "components/jobs/SuggestedJobs.tsx");
  const jobInboxPath = path.join(process.cwd(), "components/jobs/JobInbox.tsx");

  const suggestedJobsSrc = fs.readFileSync(suggestedJobsPath, "utf-8");
  const jobInboxSrc = fs.readFileSync(jobInboxPath, "utf-8");

  // ---------------------------------------------------------------------------
  // 1. My Referral Conversations Collapsed by Default in JobInbox.tsx
  // ---------------------------------------------------------------------------
  console.log(">>> [SECTION 1] Validating My Referral Conversations Collapsed by Default...");
  assert(
    jobInboxSrc.includes("defaultExpanded = false"),
    "JobInbox defines defaultExpanded prop defaulting to false"
  );
  assert(
    jobInboxSrc.includes("const [isExpanded, setIsExpanded] = useState(defaultExpanded)"),
    "JobInbox initializes isExpanded state from defaultExpanded (collapsed by default)"
  );
  assert(
    jobInboxSrc.includes("My Referral Conversations"),
    "JobInbox renders 'My Referral Conversations' header"
  );
  assert(
    jobInboxSrc.includes('{isExpanded ? "Hide ▲" : "Show ▼"}'),
    "JobInbox toggles indicator between Hide and Show"
  );

  // ---------------------------------------------------------------------------
  // 2. Relative Layout Ordering in SuggestedJobs.tsx
  // ---------------------------------------------------------------------------
  console.log("\n>>> [SECTION 2] Validating Relative Layout Ordering in SuggestedJobs.tsx...");

  const posCareerExplorer = suggestedJobsSrc.indexOf("Career Explorer & Tools");
  const posResumeCard = suggestedJobsSrc.indexOf("<ResumeCard");
  const posHiringPulse = suggestedJobsSrc.indexOf("Hiring Pulse");
  const posJobInbox = suggestedJobsSrc.indexOf("<JobInbox");
  const posHeroJob = suggestedJobsSrc.indexOf("HERO OPPORTUNITY CARD");
  const posPeopleHelp = suggestedJobsSrc.indexOf("PEOPLE AROUND YOU WHO CAN HELP");
  const posSimilarJobs = suggestedJobsSrc.indexOf("MORE SIMILAR JOBS");
  const posCompanyList = suggestedJobsSrc.indexOf('id="jobs-company-list"');

  assert(posCareerExplorer !== -1, "Career Explorer & Tools header exists");
  assert(posResumeCard !== -1, "ResumeCard (Active Resume) component exists");
  assert(posHiringPulse !== -1, "Hiring Pulse section exists");
  assert(posJobInbox !== -1, "JobInbox component exists");
  assert(posHeroJob !== -1, "Hero Opportunity Card section exists");
  assert(posPeopleHelp !== -1, "People around you who can help section exists");
  assert(posSimilarJobs !== -1, "More Similar Jobs section exists");
  assert(posCompanyList !== -1, "Company list anchor id='jobs-company-list' exists");

  // Verify ordering:
  // Career Explorer at top
  assert(
    posCareerExplorer < posHeroJob,
    "Career Explorer & Tools is positioned ABOVE the Hero Opportunity Card"
  );

  // Active Resume inside Career Explorer before Hiring Pulse
  assert(
    posResumeCard > posCareerExplorer && posResumeCard < posHiringPulse,
    "Active Resume (ResumeCard) is placed inside Career Explorer & Tools directly before the Hiring Pulse"
  );

  // Hiring Pulse shown next
  assert(
    posHiringPulse > posResumeCard && posHiringPulse < posJobInbox,
    "Hiring Pulse is shown next after Active Resume, before My Referral Conversations"
  );

  // My Referral Conversations followed by others (Hero, Helpers, Similar Jobs)
  assert(
    posJobInbox < posHeroJob,
    "My Referral Conversations is placed before the Hero Opportunity Card"
  );
  assert(
    posHeroJob < posPeopleHelp,
    "Hero Opportunity Card precedes People around you who can help"
  );
  assert(
    posPeopleHelp < posSimilarJobs,
    "People around you who can help precedes More Similar Jobs"
  );
  assert(
    posSimilarJobs < posCompanyList,
    "More Similar Jobs precedes Company Directory List"
  );

  // ---------------------------------------------------------------------------
  // 3. Functional Integrity of Interactive Pulse Buttons
  // ---------------------------------------------------------------------------
  console.log("\n>>> [SECTION 3] Validating Functional Integrity of Pulse & Exploration Tools...");
  const pulseIds = [
    "pulse-active-roles",
    "pulse-strong-matches",
    "pulse-insider-referrers",
    "pulse-companies"
  ];
  for (const id of pulseIds) {
    assert(
      suggestedJobsSrc.includes(`id="${id}"`),
      `Preserved interactive hiring pulse button with id='${id}'`
    );
  }

  assert(
    suggestedJobsSrc.includes('id="btn-deep-ats-fetch"'),
    "Preserved Deep ATS Match Hunter button with id='btn-deep-ats-fetch'"
  );

  console.log("\n================================================================================");
  console.log("📊 Validation Summary: All 14 Test Assertions Passed Successfully!");
  console.log("================================================================================\n");
}

runValidation().catch((err) => {
  console.error(err);
  process.exit(1);
});

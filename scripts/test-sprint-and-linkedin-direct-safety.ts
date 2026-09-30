import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

function runTest() {
  console.log("=== Testing Today's Sprint Priority Roles & LinkedIn Direct Safety ===");

  // 1. Check ApplicationSprintMode.tsx
  const sprintFile = path.resolve(process.cwd(), "components/jobs/ApplicationSprintMode.tsx");
  const sprintSrc = fs.readFileSync(sprintFile, "utf-8");

  console.log("1. Verifying ApplicationSprintMode.tsx...");
  assert(
    sprintSrc.includes("onSelectJob?: (job: { id: string; title: string; company: string; score?: number; url?: string }) => void"),
    "ApplicationSprintModeProps must define onSelectJob callback prop"
  );
  assert(
    !sprintSrc.includes("<a\n                    key={job.id}\n                    href={job.url}"),
    "Sprint priority roles must NOT use raw <a> link with job.url"
  );
  assert(
    sprintSrc.includes("onClick={() => onSelectJob?.(job)}"),
    "Sprint priority role cards must trigger onSelectJob(job)"
  );
  assert(
    sprintSrc.includes("View Role"),
    "Sprint priority role cards must display 'View Role' in-app indicator"
  );
  console.log("✓ ApplicationSprintMode.tsx is properly secured for in-app navigation.");

  // 2. Check SuggestedJobs.tsx
  const suggestedFile = path.resolve(process.cwd(), "components/jobs/SuggestedJobs.tsx");
  const suggestedSrc = fs.readFileSync(suggestedFile, "utf-8");

  console.log("2. Verifying SuggestedJobs.tsx...");
  assert(
    suggestedSrc.includes("onSelectJob={handleSelectSprintJob}"),
    "SuggestedJobs must pass handleSelectSprintJob to ApplicationSprintMode"
  );
  assert(
    suggestedSrc.includes("const handleSelectSprintJob = (job:"),
    "SuggestedJobs must implement handleSelectSprintJob"
  );
  assert(
    suggestedSrc.includes("setActiveCompanyModal(found)") &&
    suggestedSrc.includes("setActiveCompanyModal({"),
    "handleSelectSprintJob must route into in-app setActiveCompanyModal"
  );

  // Check Warm Connector Card in SuggestedJobs
  assert(
    !suggestedSrc.includes("<a\n                                href={bp.connector.linkedinSearchUrl}"),
    "Warm connector card must NOT have raw anchor for linkedinSearchUrl"
  );
  assert(
    !suggestedSrc.includes("<a\n                                href={bp.connector.linkedinAlumniUrl}"),
    "Warm connector card must NOT have raw anchor for linkedinAlumniUrl"
  );
  assert(
    suggestedSrc.includes("handlePioneerClick(") &&
    suggestedSrc.includes("Leaders ↗") &&
    suggestedSrc.includes("Alumni Search ↗"),
    "Warm connector card must use safe handlePioneerClick for Leaders & Alumni"
  );
  assert(
    suggestedSrc.includes("Custom Pitch") &&
    suggestedSrc.includes("setColdOutreachModalJob("),
    "Warm connector card must provide in-app Custom Pitch button"
  );
  assert(
    suggestedSrc.includes("Copy Search Link (Open in LinkedIn App)") &&
    suggestedSrc.includes("✕ Stay in ProxNet"),
    "SuggestedJobs must provide safe LinkedIn launch interstitial with Stay in ProxNet button"
  );
  console.log("✓ SuggestedJobs.tsx safely handles sprint roles and warm connector actions.");

  // 3. Check DeepConversionModal.tsx
  const deepModalFile = path.resolve(process.cwd(), "components/jobs/DeepConversionModal.tsx");
  const deepModalSrc = fs.readFileSync(deepModalFile, "utf-8");

  console.log("3. Verifying DeepConversionModal.tsx...");
  assert(
    !deepModalSrc.includes("<a\n                                href={bp.connector.linkedinSearchUrl}") &&
    !deepModalSrc.includes("href={bp.connector.linkedinSearchUrl}"),
    "DeepConversionModal must NOT have raw anchor for linkedinSearchUrl"
  );
  assert(
    !deepModalSrc.includes("href={bp.connector.linkedinAlumniUrl}"),
    "DeepConversionModal must NOT have raw anchor for linkedinAlumniUrl"
  );
  assert(
    deepModalSrc.includes("handleLaunchLinkedIn"),
    "DeepConversionModal must implement handleLaunchLinkedIn"
  );
  assert(
    deepModalSrc.includes("Copy Search Link (Open in LinkedIn App)") &&
    deepModalSrc.includes("✕ Stay in ProxNet"),
    "DeepConversionModal must provide safe LinkedIn launch dialog with Stay in ProxNet button"
  );
  console.log("✓ DeepConversionModal.tsx is properly secured against PWA hijacking.");

  console.log("\n ALL TESTS PASSED! Sprint roles and LinkedIn Direct links are safe from PWA hijacking.");
}

runTest();

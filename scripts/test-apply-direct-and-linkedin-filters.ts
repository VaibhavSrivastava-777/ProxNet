import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

function testApplyDirectAndLinkedInFilters() {
  console.log("=== Testing 'Apply Direct' In-App Navigation & LinkedIn Filter Launch ===");

  const suggestedFile = path.resolve(process.cwd(), "components/jobs/SuggestedJobs.tsx");
  const suggestedSrc = fs.readFileSync(suggestedFile, "utf-8");

  // 1. Verify "Apply Directly" and "Apply Direct" no longer use raw anchor tags
  console.log("\n1. Verifying 'Apply Direct' & 'Apply Directly' use Safe In-App Viewer...");
  
  assert(
    !suggestedSrc.includes('<a\n                                  href={cleanDirectUrl}'),
    "SuggestedJobs must NOT have raw <a href={cleanDirectUrl}> tags for Apply Directly or Apply Direct"
  );
  assert(
    !suggestedSrc.includes('href={cleanDirectUrl}\n                                  target="_blank"'),
    "SuggestedJobs must not target cleanDirectUrl with _blank anchor tag"
  );

  // Check both occurrences use handleOpenDirectApply
  const occurrencesOfHandleOpen = (suggestedSrc.match(/handleOpenDirectApply\(job, activeCompanyModal\.company\)/g) || []).length;
  assert(
    occurrencesOfHandleOpen >= 2,
    `Expected at least 2 handleOpenDirectApply calls in company modal, found: ${occurrencesOfHandleOpen}`
  );

  // Check Sprint Priority roles and Deep Hunter also use handleOpenDirectApply
  assert(
    suggestedSrc.includes("handleOpenDirectApply(") &&
    suggestedSrc.includes("bp.matchScore") &&
    suggestedSrc.includes("m.score"),
    "Sprint Priority roles and Deep Hunter must route Apply clicks to handleOpenDirectApply"
  );

  // 2. Verify directApplyModalJob Launchpad implementation
  console.log("\n2. Verifying Direct Apply ATS Launchpad Sheet Features...");
  assert(
    suggestedSrc.includes("directApplyModalJob && mounted && typeof document !== \"undefined\" && createPortal("),
    "directApplyModalJob must be portaled to document.body"
  );
  assert(
    suggestedSrc.includes("z-[100002]"),
    "directApplyModalJob must have z-[100002] to sit above activeCompanyModal (z-100000)"
  );
  assert(
    suggestedSrc.includes("Back to ProxNet"),
    "directApplyModalJob must feature a prominent 'Back to ProxNet' navigation button"
  );
  assert(
    suggestedSrc.includes("← Back to Jobs"),
    "directApplyModalJob must feature '← Back to Jobs' in sticky bottom bar"
  );
  assert(
    suggestedSrc.includes("Copy Application Link"),
    "directApplyModalJob must provide 'Copy Application Link' button"
  );
  assert(
    suggestedSrc.includes("I Applied (+1 Log)"),
    "directApplyModalJob must provide 'I Applied (+1 Log)' sprint velocity button"
  );
  assert(
    !suggestedSrc.includes("<iframe"),
    "directApplyModalJob must NOT embed an iframe (which gets blocked by external ATS X-Frame-Options with ERR_BLOCKED_BY_RESPONSE)"
  );
  assert(
    suggestedSrc.includes("detectAtsName("),
    "SuggestedJobs must detect ATS platforms (Greenhouse, Lever, Workday, etc.)"
  );
  assert(
    suggestedSrc.includes("window.history.pushState({ modal: \"direct-apply\" }"),
    "directApplyModalJob must push history state for hardware/browser back button handling"
  );

  // Check manifest.json for display_override
  const manifestFile = path.resolve(process.cwd(), "public/manifest.json");
  const manifestSrc = fs.readFileSync(manifestFile, "utf-8");
  assert(
    manifestSrc.includes("display_override") && manifestSrc.includes("minimal-ui"),
    "public/manifest.json must specify display_override with minimal-ui for PWA back button support"
  );

  console.log("✓ 'Apply Direct' ATS Launchpad verified: zero ERR_BLOCKED_BY_RESPONSE iframes, back navigation chrome, and copy link tools.");

  // 3. Verify LinkedIn Filter Launch in handlePioneerClick
  console.log("\n3. Verifying LinkedIn Launches Directly with Applied Filters...");
  assert(
    suggestedSrc.includes("const linkedInUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;"),
    "handlePioneerClick must construct LinkedIn people search URL with encoded query filters"
  );
  assert(
    suggestedSrc.includes("window.open(linkedInUrl, \"_blank\", \"noopener,noreferrer\");"),
    "handlePioneerClick must immediately open LinkedIn search with filters in new tab/app"
  );
  assert(
    suggestedSrc.includes("navigator.clipboard.writeText(linkedInUrl);"),
    "handlePioneerClick must copy the FILTERED LinkedIn URL as backup (not the invite link)"
  );
  assert(
    suggestedSrc.includes("Opening LinkedIn with filters"),
    "handlePioneerClick must notify user that LinkedIn is opening with filters"
  );
  assert(
    suggestedSrc.includes("if (!roleQuery) {\n      setLinkedInLaunchData({"),
    "handlePioneerClick must NOT open intrusive Pioneer Bounty modal when a specific roleQuery is requested"
  );

  console.log("✓ LinkedIn click launches filtered search directly and copies query URL as fallback.");

  // 4. Verify DeepConversionModal.tsx
  console.log("\n4. Verifying DeepConversionModal.tsx LinkedIn Launch...");
  const deepFile = path.resolve(process.cwd(), "components/jobs/DeepConversionModal.tsx");
  const deepSrc = fs.readFileSync(deepFile, "utf-8");

  assert(
    deepSrc.includes("window.open(url, \"_blank\", \"noopener,noreferrer\");"),
    "DeepConversionModal handleLaunchLinkedIn must directly call window.open"
  );
  assert(
    deepSrc.includes("navigator.clipboard.writeText(outreachMessage);"),
    "DeepConversionModal must copy outreach message ready to paste"
  );

  console.log("✓ DeepConversionModal.tsx launches LinkedIn directly with pre-crafted pitch copied.");

  console.log("\n✨ ALL TESTS PASSED! Apply Direct in-app back navigation and LinkedIn filtered launches are verified! ✨");
}

testApplyDirectAndLinkedInFilters();

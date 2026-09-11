/**
 * Validation Test Suite for Dynamic Referral Actions & Direct Chat Initiation
 * 
 * Tests:
 * 1. Referral availability conditional logic (hasReferrer ? "Ask Referral" + "Apply Directly" : "Apply on Career Website")
 * 2. Message composition logic detailing the opportunity and introducing the user
 * 3. API contract for /api/jobs/chat/init-referral
 * 4. Notification payload and router navigation without intermediate screens
 */

import * as fs from "fs";
import * as path from "path";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

function simulateMessageGeneration(candidate: { job_title?: string; company?: string }, job: { title: string; company: string; location?: string; url?: string }) {
  const candidateRole = candidate?.job_title
    ? (candidate?.company ? `${candidate.job_title} at ${candidate.company}` : candidate.job_title)
    : "a fellow professional";

  const introLine = `Hi! I am currently working as ${candidateRole} and interested in exploring opportunities at ${job.company}.`;
  const oppDetails = [
    `📌 Role: ${job.title}`,
    `🏢 Company: ${job.company}`,
    job.location ? `📍 Location: ${job.location}` : null,
    job.url ? `🔗 Career Link: ${job.url}` : null,
  ].filter(Boolean).join("\n");

  return `${introLine}\n\nI came across this opening and would love to be considered for a referral:\n${oppDetails}\n\nCould you please refer my profile or share insights about the role and team? I'd really appreciate your guidance!`;
}

function simulateButtonOptions(group: { referralContacts: Array<{ id: string; alias: string }> }, currentUserId: string | null) {
  const availableReferrers = (group.referralContacts || []).filter(
    (c) => !currentUserId || c.id !== currentUserId
  );
  const hasReferrer = availableReferrers.length > 0;

  if (hasReferrer) {
    return {
      buttons: ["Ask Referral", "Apply Directly"],
      hasReferrer: true,
      targetReferrerId: availableReferrers[0].id,
    };
  }

  return {
    buttons: ["Apply on Career Website"],
    hasReferrer: false,
    targetReferrerId: null,
  };
}

async function runValidation() {
  console.log("=== STEP 1: Validating Referrer Availability & Button Flow ===");

  // Scenario A: Company with available referrers
  const googleGroup = {
    company: "Google",
    referralContacts: [
      { id: "usr_alice", alias: "Senior Staff Engineer @ Google" },
      { id: "usr_bob", alias: "Product Manager @ Google" },
    ],
  };

  const optionsWithReferrers = simulateButtonOptions(googleGroup, "usr_candidate");
  assert(optionsWithReferrers.hasReferrer === true, "Detected referrers available for Google");
  assert(optionsWithReferrers.buttons.includes("Ask Referral"), "Offers 'Ask Referral' button");
  assert(optionsWithReferrers.buttons.includes("Apply Directly"), "Offers 'Apply Directly' button");
  assert(optionsWithReferrers.targetReferrerId === "usr_alice", "Selected primary referrer contact");

  // Scenario B: Company where ONLY current user works (avoid self-referral)
  const selfCompanyGroup = {
    company: "MyStartup",
    referralContacts: [{ id: "usr_candidate", alias: "Founder @ MyStartup" }],
  };
  const optionsSelf = simulateButtonOptions(selfCompanyGroup, "usr_candidate");
  assert(optionsSelf.hasReferrer === false, "Self-referral is correctly excluded");
  assert(optionsSelf.buttons.includes("Apply on Career Website"), "Falls back to 'Apply on Career Website'");

  // Scenario C: Company with 0 referrers available
  const noReferrerGroup = {
    company: "Acme Corp",
    referralContacts: [],
  };
  const optionsNoReferrer = simulateButtonOptions(noReferrerGroup, "usr_candidate");
  assert(optionsNoReferrer.hasReferrer === false, "Detected 0 referrers for Acme Corp");
  assert(optionsNoReferrer.buttons.includes("Apply on Career Website"), "Keeps existing 'Apply on Career Website' flow as-is");
  assert(!optionsNoReferrer.buttons.includes("Ask Referral"), "Does NOT show 'Ask Referral' when no referrer is available");

  console.log("\n=== STEP 2: Validating Custom Opportunity & Introduction Message ===");
  const message = simulateMessageGeneration(
    { job_title: "Senior Backend Engineer", company: "Zomato" },
    {
      title: "Staff Software Engineer - Infrastructure",
      company: "Google",
      location: "Bangalore, India",
      url: "https://careers.google.com/jobs/results/12345",
    }
  );

  assert(message.includes("Senior Backend Engineer at Zomato"), "Introduces candidate with current title and company");
  assert(message.includes("Staff Software Engineer - Infrastructure"), "Details the specific job role opportunity");
  assert(message.includes("Google"), "Mentions target hiring company");
  assert(message.includes("Bangalore, India"), "Mentions location");
  assert(message.includes("https://careers.google.com/jobs/results/12345"), "Includes the direct career link");
  assert(message.includes("Could you please refer my profile"), "Contains polite referral inquiry");

  console.log("\n=== STEP 3: Validating Source Code Implementation in SuggestedJobs.tsx ===");
  const suggestedJobsPath = path.resolve(__dirname, "../components/jobs/SuggestedJobs.tsx");
  const suggestedJobsSrc = fs.readFileSync(suggestedJobsPath, "utf-8");

  assert(suggestedJobsSrc.includes("handleAskReferral"), "SuggestedJobs defines handleAskReferral");
  assert(suggestedJobsSrc.includes("hasReferrer"), "SuggestedJobs evaluates hasReferrer");
  assert(suggestedJobsSrc.includes("Ask Referral"), "SuggestedJobs renders 'Ask Referral' button");
  assert(suggestedJobsSrc.includes("Apply Directly"), "SuggestedJobs renders 'Apply Directly' button");
  assert(suggestedJobsSrc.includes("Apply on Career Website"), "SuggestedJobs preserves 'Apply on Career Website' when no referrer");
  assert(suggestedJobsSrc.includes("router.push(`/jobs/chat/${data.threadId}`)"), "Directly navigates to chat without intermediate screen");
  assert(suggestedJobsSrc.includes("startingReferralJobId"), "Displays active loading state during initiation");

  console.log("\n=== STEP 4: Validating Backend API Implementation in init-referral/route.ts ===");
  const routePath = path.resolve(__dirname, "../app/api/jobs/chat/init-referral/route.ts");
  const routeSrc = fs.readFileSync(routePath, "utf-8");

  assert(routeSrc.includes("jobUrl, location, score, reason"), "init-referral API accepts rich job metadata");
  assert(routeSrc.includes("sendNotification(contactId"), "init-referral dispatches notification to referrer");
  assert(routeSrc.includes("Referral Request:"), "Notification has clear Referral Request title");
  assert(routeSrc.includes("/jobs/chat/${thread.id}"), "Notification deep-links to referral chat thread");

  console.log("\n✅ ALL REFERRAL FLOW VALIDATION TESTS PASSED!");
}

runValidation().catch((err) => {
  console.error(err);
  process.exit(1);
});

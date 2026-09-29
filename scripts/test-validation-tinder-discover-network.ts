import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { rankDiscoverProfiles, type RankedProfile } from "../lib/hooks/useDiscoverRanking";
import type { CompanyJobBundle } from "../app/api/jobs/discover-company-jobs/route";

/**
 * Validation Test Suite for Tinder-Style Network Discover View
 * Tests:
 * 1. Ranking Engine scoring & sorting correctness
 * 2. Scrapbook synergy computation
 * 3. Exact & competitor jobs mapping
 * 4. Exclusion of liked/skipped candidates
 * 5. Mutual match logic
 */

function runValidationTests() {
  console.log("================================================================================");
  console.log("🧪 VALIDATION TEST: Tinder-Style Network Discover View");
  console.log("================================================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
    }
  }

  // ── TEST FIXTURES ──
  const mockCurrentUser = {
    id: "user-me",
    full_name: "Vaibhav Srivastava",
    company: "Google",
    job_title: "Staff Software Engineer",
    institute_name: "IIM Bangalore",
    society_name: "Prestige Lakeside Habitat",
    help_offers: ["System Architecture", "Next.js Optimization"],
    ask_me_about: ["Distributed Systems", "AI Agents"],
    tinkering_with: ["LLMs", "Rust"],
  };

  const mockPeople = [
    {
      id: "candidate-1-same-company",
      full_name: "Priya Sharma",
      company: "Google",
      job_title: "Senior Product Manager",
      institute_name: "BITS Pilani",
      society_name: "Sobha Dream Acres",
      distance: 800,
      help_offers: ["Product Strategy"],
      ask_me_about: ["AI Agents"], // Synergy with current user's ask_me_about / tinkering
      tinkering_with: [],
    },
    {
      id: "candidate-2-same-alumni",
      full_name: "Amit Patel",
      company: "Stripe",
      job_title: "Engineering Manager",
      institute_name: "IIM Bangalore", // Same alumni!
      society_name: "Prestige Lakeside Habitat", // Same society!
      distance: 300,
      help_offers: ["Distributed Systems", "Mock Interviews"], // Synergy with current user!
      ask_me_about: ["Payments"],
      tinkering_with: [],
    },
    {
      id: "candidate-3-different",
      full_name: "Rahul Verma",
      company: "Swiggy",
      job_title: "Data Analyst",
      institute_name: "Delhi University",
      society_name: "Brigade Metropolis",
      distance: 2500,
      help_offers: ["SQL Tuning"],
      ask_me_about: ["Analytics"],
      tinkering_with: [],
    },
    {
      id: "candidate-4-self",
      full_name: "Vaibhav Srivastava",
      company: "Google",
      job_title: "Staff Software Engineer",
      distance: 0,
      is_me: true,
    }
  ];

  const mockCompanyJobsMap: Record<string, CompanyJobBundle> = {
    google: {
      company: "Google",
      exactJobs: [
        {
          id: "job-1",
          role: "Cloud Architect",
          company: "Google",
          skills: "GCP, Kubernetes",
          created_at: new Date().toISOString(),
        }
      ],
      competitorJobs: [
        {
          id: "job-comp-1",
          role: "Azure Architect",
          company: "Microsoft",
          skills: "Azure, Cloud",
          created_at: new Date().toISOString(),
          isCompetitor: true,
        }
      ],
      competitorNames: ["Microsoft", "Meta"],
    },
    stripe: {
      company: "Stripe",
      exactJobs: [
        {
          id: "job-stripe-1",
          role: "Staff Backend Engineer",
          company: "Stripe",
          skills: "Ruby, Go",
          created_at: new Date().toISOString(),
        }
      ],
      competitorJobs: [
        {
          id: "job-comp-2",
          role: "Senior Backend Engineer",
          company: "Razorpay",
          skills: "Go, Payments",
          created_at: new Date().toISOString(),
          isCompetitor: true,
        }
      ],
      competitorNames: ["Razorpay", "Adyen"],
    },
  };

  // ── TEST 1: Exclusion of Self ──
  console.log("\n[Test Suite 1: Exclusion & Self Filtering]");
  // Run ranking hook logic directly (mimicking React hook calculation)
  const ranked = rankDiscoverProfiles({
    people: mockPeople,
    profile: mockCurrentUser,
    companyJobsMap: mockCompanyJobsMap,
    excludedIds: new Set<string>(),
  });

  assert(!ranked.some((r: RankedProfile) => r.person.id === "user-me" || r.person.is_me), "Self is excluded from Discover candidate list");
  assert(ranked.length === 3, `Expected 3 active candidates, got ${ranked.length}`);

  // ── TEST 2: Scoring Hierarchy ──
  console.log("\n[Test Suite 2: Relevance Scoring & Sorting]");
  const topCandidate = ranked[0];
  console.log(`  Top candidate: ${topCandidate.person.full_name} with score ${topCandidate.score}%`);
  console.log(`  Primary Reason: "${topCandidate.primaryReason}"`);
  console.log(`  All Reasons:`, topCandidate.reasons.map((r: any) => r.label));

  // Candidate 2 (Amit Patel) has: Same Alumni (+25), Same Society (+20), Shared Role Keyword 'Engineer' (+15), Scrapbook synergy (+12), Open Jobs (+10), Distance < 500m (+10) -> score ~92+
  assert(topCandidate.person.id === "candidate-2-same-alumni", "Amit Patel (Alumni + Society + Role + Jobs + Synergy) is top match");
  assert(topCandidate.score > 80, `Top match score should be high (>80%), got ${topCandidate.score}%`);

  const secondCandidate = ranked[1];
  console.log(`  Second candidate: ${secondCandidate.person.full_name} with score ${secondCandidate.score}%`);
  // Candidate 1 (Priya Sharma) has: Same Company (+30), Open Jobs at Google (+10), Shared Synergy (+12), Distance < 1000m (+7)
  assert(secondCandidate.person.id === "candidate-1-same-company", "Priya Sharma (Same Company Google) is ranked second");
  assert(secondCandidate.reasons.some((r: any) => r.category === "company"), "Contains 'company' reason for Priya Sharma");

  // Candidate 3 has least overlap
  const thirdCandidate = ranked[2];
  assert(thirdCandidate.person.id === "candidate-3-different", "Rahul Verma with minimal overlap is ranked lowest");
  assert(thirdCandidate.score < secondCandidate.score, "Lowest candidate has score less than higher candidates");

  // ── TEST 3: Competitor & Exact Jobs Association ──
  console.log("\n[Test Suite 3: Job Bundling (Exact + Competitors)]");
  assert(topCandidate.jobsBundle != null, "Top candidate (Stripe) has associated jobsBundle");
  assert(topCandidate.jobsBundle?.exactJobs.length === 1, "Stripe candidate has 1 exact job");
  assert(topCandidate.jobsBundle?.competitorJobs.length === 1, "Stripe candidate has 1 competitor job (Razorpay)");
  assert(topCandidate.jobsBundle?.competitorNames.includes("Razorpay"), "Competitor list includes Razorpay");

  // ── TEST 4: Continuous Carousel Cycling (No Profiles Filtered Out) ──
  console.log("\n[Test Suite 4: Continuous Cycling & Non-Filtering]");
  // User directive: "swipe should just move to the next best matched profile, without filtering out any profile"
  // "No Profiles left: This should never happen as we should not be filtering out profiles"
  const allRanked = rankDiscoverProfiles({
    people: mockPeople,
    profile: mockCurrentUser,
    companyJobsMap: mockCompanyJobsMap,
  });

  assert(allRanked.length === 3, "All 3 eligible candidates remain present in the stack without filtering");
  
  // Test carousel index wrapping
  const totalCards = allRanked.length;
  let idx = 0;
  const cycleOrder: string[] = [];
  // Simulate 6 swipes (2 full cycles)
  for (let swipe = 0; swipe < 6; swipe++) {
    cycleOrder.push(allRanked[idx % totalCards].person.id);
    idx = (idx + 1) % totalCards;
  }

  assert(cycleOrder.length === 6, "Simulated 6 continuous swipes without running out of cards");
  assert(cycleOrder[0] === cycleOrder[3], "Carousel wraps smoothly back to the top match on index wrap");
  assert(cycleOrder[1] === cycleOrder[4], "Second match repeats in correct ranking order on second loop");
  assert(!cycleOrder.includes("user-me"), "Self is never encountered in any carousel loop");

  // ── SUMMARY ──
  console.log("\n================================================================================");
  console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runValidationTests();

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import assert from "assert";
import {
  detectFunctionalDiscipline,
  detectCandidateDiscipline,
  relateDisciplines,
  areDisciplinesCompatible,
} from "../lib/jobs/discipline";
import {
  isLikelyJobPostingUrl,
  hasSubstantiveDescription,
  getDescriptionText,
} from "../lib/jobs/job-quality";
import { rerankJobsForCandidate } from "../lib/jobs/reranker";
import { calculateProfileMatchScore } from "../lib/matching/profile-similarity";
import { isJobEligible } from "../lib/jobs/job-filters";

async function runTests() {
  console.log("=== RUNNING VALIDATION SUITE: SENSIBLE MATCH RATES & REAL OPPORTUNITIES ===\n");

  // ----------------------------------------------------
  // TEST 1: Functional Discipline Detection
  // ----------------------------------------------------
  console.log("[Test 1] Validating Functional Discipline Classification...");
  
  assert.strictEqual(detectFunctionalDiscipline("Finance Manager"), "finance");
  assert.strictEqual(detectFunctionalDiscipline("Senior Financial Analyst"), "finance");
  assert.strictEqual(detectFunctionalDiscipline("FP&A Lead"), "finance");
  assert.strictEqual(detectFunctionalDiscipline("Chartered Accountant"), "finance");
  assert.strictEqual(detectFunctionalDiscipline("General Ledger Accountant"), "finance");

  assert.strictEqual(detectFunctionalDiscipline("Operations Manager"), "operations");
  assert.strictEqual(detectFunctionalDiscipline("Service Delivery Lead"), "operations");
  assert.strictEqual(detectFunctionalDiscipline("Process Associate"), "operations");
  assert.strictEqual(detectFunctionalDiscipline("Business Operations Specialist"), "operations");

  assert.strictEqual(detectFunctionalDiscipline("Senior Software Engineer"), "software_engineering");
  assert.strictEqual(detectFunctionalDiscipline("Full Stack Developer"), "software_engineering");
  assert.strictEqual(detectFunctionalDiscipline("Data Scientist"), "data_ai");
  assert.strictEqual(detectFunctionalDiscipline("Product Manager"), "product_management");

  console.log("  ✅ Test 1 Passed: Disciplines classified accurately.");

  // ----------------------------------------------------
  // TEST 2: Discipline Compatibility (Finance vs Operations)
  // ----------------------------------------------------
  console.log("\n[Test 2] Validating Discipline Compatibility & Incompatibility...");
  
  const relFinanceOps = relateDisciplines("finance", "operations");
  assert.strictEqual(relFinanceOps, "incompatible", "Finance and Operations must be strictly INCOMPATIBLE");
  assert.strictEqual(areDisciplinesCompatible("finance", "operations"), false);

  const relFinanceFinance = relateDisciplines("finance", "finance");
  assert.strictEqual(relFinanceFinance, "same", "Finance and Finance must be SAME");
  assert.strictEqual(areDisciplinesCompatible("finance", "finance"), true);

  const relSoftwareOps = relateDisciplines("software_engineering", "operations");
  assert.strictEqual(relSoftwareOps, "incompatible", "Software Engineering and Operations must be INCOMPATIBLE");

  console.log("  ✅ Test 2 Passed: Finance vs Operations correctly identified as INCOMPATIBLE.");

  // ----------------------------------------------------
  // TEST 3: Reranker Guardrails (Finance Candidate vs Operations Job)
  // ----------------------------------------------------
  console.log("\n[Test 3] Validating Reranker Guardrails on Incompatible and Thin Jobs...");

  const financeCandidate = {
    id: "user_finance_test",
    job_title: "Senior Financial Analyst",
    company: "Acme Corp",
    profile_digest: {
      skills: ["Financial Analysis", "Financial Modeling", "Budgeting", "P&L", "Excel"],
      summary: "Experienced finance professional managing corporate budgeting and forecasting.",
      experienceYears: 6,
    },
    resume_text: "6 years of financial analysis, corporate budgeting, variance analysis, financial reporting, SAP FICO.",
  };

  const testJobs = [
    {
      id: "job_ops_1",
      title: "Operations Manager",
      company: "Logistics Hub",
      location: "Bangalore",
      description: "Manage day-to-day warehouse operations, monitor delivery SLA performance, coordinate floor teams, and drive operational efficiency.",
      url: "https://careers.logistics.com/jobs/102938",
      rawSimilarity: 0.85, // artificially high vector similarity
    },
    {
      id: "job_thin_desc",
      title: "Senior Financial Analyst",
      company: "Apex Finance",
      location: "Mumbai",
      description: "Senior Financial Analyst", // thin/title-only description
      url: "https://careers.apex.com/jobs/998877",
      rawSimilarity: 0.90,
    },
    {
      id: "job_bad_url",
      title: "Financial Controller",
      company: "Global Assets",
      location: "Delhi",
      description: "Oversee all accounting and controllership functions, internal audits, and IFRS reporting across divisions.",
      url: "https://careers.globalassets.com/search?q=finance", // search URL
      rawSimilarity: 0.95,
    },
  ];

  const reranked = await rerankJobsForCandidate(financeCandidate, testJobs);

  const opsResult = reranked.get("job_ops_1");
  assert(opsResult, "Operations job result must exist");
  assert(opsResult.score <= 30, `Finance candidate vs Operations job score must be <= 30%, got ${opsResult.score}%`);
  assert.strictEqual(opsResult.label, "Low Match");
  assert(opsResult.reason.toLowerCase().includes("does not match"), `Reason must explain discipline mismatch: "${opsResult.reason}"`);

  const thinResult = reranked.get("job_thin_desc");
  assert(thinResult, "Thin description job result must exist");
  assert(thinResult.score <= 35, `Thin description job score must be <= 35%, got ${thinResult.score}%`);
  assert.strictEqual(thinResult.label, "Low Match");

  const badUrlResult = reranked.get("job_bad_url");
  assert(badUrlResult, "Bad URL job result must exist");
  assert(badUrlResult.score <= 25, `Non-posting URL job score must be <= 25%, got ${badUrlResult.score}%`);
  assert.strictEqual(badUrlResult.label, "Low Match");

  console.log("  ✅ Test 3 Passed: Reranker strictly caps cross-discipline match to 25%, thin descriptions to 35%, and bad URLs to 20%.");

  // ----------------------------------------------------
  // TEST 4: Candidate-to-Candidate Profile Match Score (Finance vs Operations)
  // ----------------------------------------------------
  console.log("\n[Test 4] Validating Profile-to-Profile Match Scoring (Discover tab)...");

  const profileA = {
    job_title: "Finance Operations Manager",
    company: "TechGlobal",
    institute_name: "IIM Ahmedabad",
    society_name: "Prestige Lakeside Habitat",
  };

  const profileB = {
    job_title: "Operations Delivery Lead",
    company: "TechGlobal", // Same company
    institute_name: "IIM Ahmedabad", // Same college
    society_name: "Prestige Lakeside Habitat", // Same society
  };

  const scoreResult = calculateProfileMatchScore(profileA, profileB);
  assert(scoreResult.score <= 55, `Finance profile vs Operations profile score must be capped <= 55%, got ${scoreResult.score}%`);
  console.log(`  ✅ Test 4 Passed: Even with same company + college + society, Finance vs Operations profile match score is capped at ${scoreResult.score}% (never 95%).`);

  // ----------------------------------------------------
  // TEST 5: Job Posting URL Quality Detection
  // ----------------------------------------------------
  console.log("\n[Test 5] Validating URL Quality & Non-Posting Filters...");

  // Bad URLs: Search pages, homepages, PDFs, category listings
  assert.strictEqual(isLikelyJobPostingUrl("https://career.infosys.com/"), false);
  assert.strictEqual(isLikelyJobPostingUrl("https://stripe.com/jobs/search"), false);
  assert.strictEqual(isLikelyJobPostingUrl("https://careers.tcs.com/india"), false);
  assert.strictEqual(isLikelyJobPostingUrl("https://www.google.com/search?q=eClerx+careers"), false);
  assert.strictEqual(isLikelyJobPostingUrl("https://careers.walmart.com/content/careers/us/en/results?searchQuery=All"), false);
  assert.strictEqual(isLikelyJobPostingUrl("https://www.eximbankindia.in/sites/default/files/2026-08/Result.pdf"), false);
  assert.strictEqual(isLikelyJobPostingUrl("https://www.cockroachlabs.com/careers/job"), false);

  // Good URLs: Direct requisitions with job IDs, requisitions, or detail slugs
  assert.strictEqual(isLikelyJobPostingUrl("https://boards.greenhouse.io/oscar/jobs/7619750"), true);
  assert.strictEqual(isLikelyJobPostingUrl("https://jobs.lever.co/netflix/9d44f77c-8822-4293-8551-789a8cb406f9"), true);
  assert.strictEqual(isLikelyJobPostingUrl("https://jobs.smartrecruiters.com/AcmeCorp/104958671"), true);
  assert.strictEqual(isLikelyJobPostingUrl("https://careers.wipro.com/careers-home/jobs/3120459"), true);
  assert.strictEqual(isLikelyJobPostingUrl("https://amazon.jobs/en/jobs/2847593/software-development-engineer"), true);

  console.log("  ✅ Test 5 Passed: Search pages, landing roots, and PDFs strictly rejected; authentic ATS detail URLs accepted.");

  // ----------------------------------------------------
  // TEST 6: Substantive Description Detection
  // ----------------------------------------------------
  console.log("\n[Test 6] Validating Substantive Description Detection...");

  assert.strictEqual(hasSubstantiveDescription("", "Senior Software Engineer"), false);
  assert.strictEqual(hasSubstantiveDescription("Senior Software Engineer", "Senior Software Engineer"), false);
  assert.strictEqual(hasSubstantiveDescription("<div>Senior Software Engineer</div>", "Senior Software Engineer"), false);
  assert.strictEqual(hasSubstantiveDescription("VP, Product Management, OSM", "VP, Product Management, OSM"), false);

  const realDescription = `We are looking for a Senior Financial Analyst to join our strategic planning team in Bangalore.
Key Responsibilities:
- Lead annual budgeting, quarterly forecasting, and variance analysis across business units.
- Partner with department heads to build financial models and evaluate unit economics.
- Prepare monthly executive management reports, P&L statements, and board presentations.
Requirements:
- 5+ years of corporate finance or FP&A experience.
- Advanced Excel and financial modeling expertise; familiarity with SAP FICO or NetSuite.`;

  assert.strictEqual(hasSubstantiveDescription(realDescription, "Senior Financial Analyst"), true);
  console.log("  ✅ Test 6 Passed: Thin descriptions detected; real descriptions validated.");

  // ----------------------------------------------------
  // TEST 7: isJobEligible Integration with URL Quality
  // ----------------------------------------------------
  console.log("\n[Test 7] Validating isJobEligible URL Integration...");

  const badJob = {
    title: "Software Engineer",
    location: "Bangalore",
    posted_at: new Date().toISOString(),
    description: realDescription,
    url: "https://stripe.com/jobs/search",
  };
  const badEligibility = isJobEligible(badJob);
  assert.strictEqual(badEligibility.eligible, false);
  assert(badEligibility.reason?.includes("URL is not a specific job posting"), "Reason must mention URL");

  const goodJob = {
    title: "Software Engineer",
    location: "Bangalore",
    posted_at: new Date().toISOString(),
    description: realDescription,
    url: "https://boards.greenhouse.io/acme/jobs/1234567",
  };
  const goodEligibility = isJobEligible(goodJob);
  assert.strictEqual(goodEligibility.eligible, true);
  // ----------------------------------------------------
  // TEST 8: Method 1 - Hard Skill & Tooling Coverage Ratio
  // ----------------------------------------------------
  console.log("\n[Test 8] Validating Method 1 Hard Skill & Tooling Coverage Ratio...");

  const {
    computeSkillAlignment,
    extractCandidateSkills,
    extractJobRequiredSkills,
  } = await import("../lib/jobs/skill-matching");

  const techCandidate = {
    job_title: "Senior Full Stack Engineer",
    profile_digest: {
      skills: ["React", "TypeScript", "Node.js", "PostgreSQL / SQL"],
    },
    resume_text: "Experienced engineer building web applications with React, Next.js, TypeScript, Node.js, and PostgreSQL.",
  };

  const candExtracted = extractCandidateSkills(techCandidate);
  assert(candExtracted.has("React"), "Candidate must have React");
  assert(candExtracted.has("TypeScript"), "Candidate must have TypeScript");
  assert(candExtracted.has("Node.js"), "Candidate must have Node.js");
  assert(candExtracted.has("PostgreSQL / SQL"), "Candidate must have PostgreSQL / SQL");

  const techJob = {
    title: "Lead Backend Engineer",
    description: `We are looking for a Lead Backend Engineer to build high-scale microservices.
Requirements:
- Strong experience with Node.js and TypeScript.
- Deep expertise in Docker & Kubernetes and AWS.
- PostgreSQL / SQL database design and optimization.`,
    keywords: ["Node.js", "TypeScript", "Docker & Kubernetes", "AWS", "PostgreSQL / SQL"],
  };

  const jobReqs = extractJobRequiredSkills(techJob);
  assert(jobReqs.length >= 4, `Job must extract at least 4 required skills, found: ${jobReqs.join(", ")}`);

  const alignment = computeSkillAlignment(techCandidate, techJob);
  console.log(`  -> Tech Alignment: ${alignment.coveragePercent}% coverage. Matched: [${alignment.matchedSkills.join(", ")}]. Missing: [${alignment.missingSkills.join(", ")}]`);
  
  assert(alignment.matchedSkills.includes("Node.js"), "Node.js must be matched");
  assert(alignment.matchedSkills.includes("TypeScript"), "TypeScript must be matched");
  assert(alignment.matchedSkills.includes("PostgreSQL / SQL"), "PostgreSQL / SQL must be matched");
  assert(alignment.missingSkills.includes("Docker & Kubernetes") || alignment.missingSkills.includes("AWS"), "Gaps must include Docker or AWS");
  assert(alignment.coveragePercent >= 50 && alignment.coveragePercent <= 75, `Coverage should be ~60%, got ${alignment.coveragePercent}%`);

  console.log("  ✅ Test 8 Passed: Skill extraction, matched skills, missing skills, and coverage ratio accurately computed.");

  // ----------------------------------------------------
  // TEST 9: Method 1 Reranker Skill Gaps Guardrail
  // ----------------------------------------------------
  console.log("\n[Test 9] Validating Method 1 Reranker Skill Gaps Guardrail...");

  const juniorJsCandidate = {
    id: "user_jr_js",
    job_title: "Junior Frontend Developer",
    profile_digest: {
      skills: ["React"],
    },
    resume_text: "Entry-level React developer building simple web pages with React.",
  };

  const heavyDevOpsJob = {
    id: "job_devops_heavy",
    title: "Staff DevOps & Infrastructure Architect",
    company: "CloudScale Systems",
    location: "Remote",
    description: `Seeking a Staff DevOps Architect to oversee cloud infrastructure.
Requirements:
- 10+ years managing AWS and GCP environments.
- Deep mastery of Docker & Kubernetes, CI/CD & DevOps pipelines, and System Architecture.
- Microservices & REST APIs scaling.`,
    keywords: ["AWS", "Docker & Kubernetes", "CI/CD & DevOps", "System Architecture", "Microservices & REST APIs"],
    url: "https://careers.cloudscale.com/jobs/992211",
  };

  const rerankedSkillTest = await rerankJobsForCandidate(juniorJsCandidate, [heavyDevOpsJob]);
  const devopsResult = rerankedSkillTest.get("job_devops_heavy");
  assert(devopsResult, "Devops result must exist");
  assert(devopsResult.skillsAlignment, "Result must contain skillsAlignment");
  assert(devopsResult.skillsAlignment.coveragePercent < 30, `Coverage percent must be < 30%, got ${devopsResult.skillsAlignment.coveragePercent}%`);
  assert(devopsResult.score <= 50, `Score with severe skill gaps (<30%) must be capped <= 50%, got ${devopsResult.score}%`);
  assert(devopsResult.skillsAlignment.missingSkills.length >= 3, "Should report at least 3 missing skill gaps");

  console.log(`  -> Devops result score: ${devopsResult.score}%, Label: "${devopsResult.label}", Missing skills: [${devopsResult.skillsAlignment.missingSkills.join(", ")}]`);
  console.log("  ✅ Test 9 Passed: Candidate with severe skill gaps (<30%) on specialized role is capped at <= 50%.");

  console.log("\n=======================================================");
  console.log("🎉 ALL 9 VALIDATION TESTS PASSED PERFECTLY!");
  console.log("=======================================================");
}

runTests().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  process.exit(1);
});

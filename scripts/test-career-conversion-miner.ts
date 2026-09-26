import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import assert from "assert";
import {
  fetchCandidateContext,
  resolveConnector,
  fetchLiveHpOpportunities,
  generateConversionBlueprint
} from "./deep-career-conversion-miner";

async function runTests() {
  console.log("🧪 RUNNING VALIDATION TEST SUITE: Career Conversion Miner");
  console.log("---------------------------------------------------------");

  // Test 1: Validate Candidate Context Retrieval
  console.log("Test 1: Fetching Candidate Context for Vaibhav...");
  const candidate = await fetchCandidateContext();
  assert(candidate.id, "Candidate ID must exist");
  assert.strictEqual(candidate.fullName, "Vaibhav Srivastava", "Name must be Vaibhav Srivastava");
  assert.strictEqual(candidate.currentCompany, "Dell Technologies", "Company must be Dell Technologies");
  assert.strictEqual(candidate.education, "IIM Lucknow", "Education must be IIM Lucknow");
  assert(candidate.resumeText && candidate.resumeText.length > 500, "Resume text must be populated");
  console.log("✅ Test 1 Passed: Candidate profile & resume correctly loaded.");

  // Test 2: Validate Connector Resolution
  console.log("\nTest 2: Validating Connector Resolution (ProxNet vs LinkedIn)...");
  
  // 2a. Lenovo should resolve ProxNet insider (Harsh Pranav)
  const lenovoConn = await resolveConnector("Lenovo", "IIM Lucknow", "Software PM");
  assert.strictEqual(lenovoConn.type, "proxnet", "Lenovo should resolve to ProxNet insider");
  assert(lenovoConn.name?.includes("Harsh"), `Expected Harsh Pranav, got ${lenovoConn.name}`);
  console.log(`  - Lenovo Connector: ${lenovoConn.name} (${lenovoConn.role}) [PROXNET]`);

  // 2b. Google should resolve ProxNet insider (Sumit Kishore)
  const googleConn = await resolveConnector("Google", "IIM Lucknow", "Lead Product Manager");
  assert.strictEqual(googleConn.type, "proxnet", "Google should resolve to ProxNet insider");
  assert(googleConn.name?.includes("Sumit"), `Expected Sumit Kishore, got ${googleConn.name}`);
  console.log(`  - Google Connector: ${googleConn.name} (${googleConn.role}) [PROXNET]`);

  // 2c. HP should resolve LinkedIn fallback with IIM Lucknow alumni search and outreach note
  const hpConn = await resolveConnector("HP", "IIM Lucknow", "Artificial Intelligence Business Architect", "3166630");
  assert.strictEqual(hpConn.type, "linkedin", "HP should resolve to LinkedIn");
  assert(hpConn.linkedinAlumniUrl?.includes("IIM%20Lucknow"), "Alumni URL must filter by IIM Lucknow");
  assert(hpConn.outreachMessage.includes("3166630"), "Outreach note must reference Req #3166630");
  console.log(`  - HP Connector: LinkedIn Alumni Search + Custom Note`);
  console.log("✅ Test 2 Passed: Connector logic properly routes ProxNet insiders vs LinkedIn fallback.");

  // Test 3: Validate Live HP Workday Scraping
  console.log("\nTest 3: Validating Live HP Workday API fetch...");
  const hpJobs = await fetchLiveHpOpportunities();
  assert(Array.isArray(hpJobs), "hpJobs must be an array");
  assert(hpJobs.length > 0, "Must return at least 1 HP job");
  const firstJob = hpJobs[0];
  assert(firstJob.title, "HP job must have a title");
  assert(firstJob.url?.startsWith("http"), "HP job must have a valid URL");
  console.log(`✅ Test 3 Passed: Successfully pulled ${hpJobs.length} live HP jobs from Workday CXS API.`);

  // Test 4: Validate Conversion Blueprint Generation (Focus X, Y, Z)
  console.log("\nTest 4: Validating AI Conversion Blueprint Generation (Focus X, Y, Z)...");
  const sampleJob = {
    title: "Artificial Intelligence Business Architect",
    company: "HP",
    location: "Bengaluru, Karnataka, India",
    url: "https://jobs.hp.com/sample",
    description: "The AI Business Architect is responsible for identifying, designing, and enabling AI-driven business transformations that deliver measurable business outcomes. Leading agentic workflows, LLM integration, and enterprise stakeholder alignment.",
    reqId: "3166630"
  };

  const blueprint = await generateConversionBlueprint(candidate, sampleJob);
  assert(blueprint.matchScore >= 70 && blueprint.matchScore <= 100, "Match score must be between 70 and 100");
  assert(blueprint.focusX?.title, "Focus X must have a title");
  assert(blueprint.focusX?.description, "Focus X must have a description");
  assert(blueprint.focusY?.keywordsToAdd?.length > 0, "Focus Y must have keywords to add");
  assert(blueprint.focusZ?.interviewPitch, "Focus Z must have an interview pitch");
  assert(blueprint.focusZ?.objectionHandler, "Focus Z must have an objection handler");
  console.log(`  - Match Score: ${blueprint.matchScore}% (${blueprint.fitVerdict})`);
  console.log(`  - Focus X Title: ${blueprint.focusX.title}`);
  console.log(`  - Focus Y Keywords: ${blueprint.focusY.keywordsToAdd.join(", ")}`);
  console.log(`  - Focus Z Pitch: "${blueprint.focusZ.interviewPitch.slice(0, 80)}..."`);
  console.log("✅ Test 4 Passed: AI Blueprint accurately synthesizes Focus X, Y, and Z.");

  console.log("\n🎉 ALL 4 VALIDATION TESTS PASSED PERFECTLY!");
}

runTests().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});

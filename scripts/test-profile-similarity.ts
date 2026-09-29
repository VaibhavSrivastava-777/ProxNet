import {
  cosineSimilarity,
  buildProfileTermVector,
  termVectorCosineSimilarity,
  computeProfileCosineSimilarity,
  calculateProfileMatchScore,
} from "../lib/matching/profile-similarity";
import assert from "assert";

function run() {
  console.log("Testing profile cosine similarity...");

  const me = {
    company: "Google",
    job_title: "Staff Software Engineer",
    institute_name: "IIM Bangalore",
    society_name: "Prestige Lakeside Habitat",
    help_offers: ["System Architecture", "Next.js Optimization"],
    ask_me_about: ["Distributed Systems", "AI Agents"],
    tinkering_with: ["LLMs", "Rust"],
  };

  const cand1 = {
    id: "cand1",
    company: "Google",
    job_title: "Senior Product Manager",
    institute_name: "BITS Pilani",
    society_name: "Sobha Dream Acres",
    help_offers: ["Product Strategy"],
    ask_me_about: ["AI Agents"],
    tinkering_with: [],
  };

  const cand2 = {
    id: "cand2",
    company: "Stripe",
    job_title: "Engineering Manager",
    institute_name: "IIM Bangalore",
    society_name: "Prestige Lakeside Habitat",
    help_offers: ["Distributed Systems", "Mock Interviews"],
    ask_me_about: ["Payments"],
    tinkering_with: [],
  };

  const cand3 = {
    id: "cand3",
    company: "Swiggy",
    job_title: "Data Analyst",
    institute_name: "Delhi University",
    society_name: "Brigade Metropolis",
    help_offers: ["SQL Tuning"],
    ask_me_about: ["Analytics"],
    tinkering_with: [],
  };

  const sim1 = computeProfileCosineSimilarity(me, cand1);
  const sim2 = computeProfileCosineSimilarity(me, cand2);
  const sim3 = computeProfileCosineSimilarity(me, cand3);

  console.log("Sim Cand 1 (Google PM):", sim1.toFixed(4));
  console.log("Sim Cand 2 (Stripe EM, IIMB):", sim2.toFixed(4));
  console.log("Sim Cand 3 (Swiggy Analyst):", sim3.toFixed(4));

  assert(sim2 > sim3, "Candidate 2 with shared alumni, society, role, and skills has higher similarity than Cand 3");
  assert(sim1 > sim3, "Candidate 1 with shared company has higher similarity than Cand 3");

  const score1 = calculateProfileMatchScore(me, cand1);
  const score2 = calculateProfileMatchScore(me, cand2);
  const score3 = calculateProfileMatchScore(me, cand3);

  console.log("Score Cand 1:", score1.score);
  console.log("Score Cand 2:", score2.score);
  console.log("Score Cand 3:", score3.score);

  assert(score2.score >= score1.score, "Cand 2 score >= Cand 1 score");
  assert(score1.score > score3.score, "Cand 1 score > Cand 3 score");

  // Test vector embeddings calculation
  const vecA = [1, 0, 1, 0];
  const vecB = [1, 0, 1, 0];
  const vecC = [0, 1, 0, 1];
  assert.strictEqual(cosineSimilarity(vecA, vecB), 1);
  assert.strictEqual(cosineSimilarity(vecA, vecC), 0);

  console.log("✅ All profile cosine similarity tests passed!");
}

run();

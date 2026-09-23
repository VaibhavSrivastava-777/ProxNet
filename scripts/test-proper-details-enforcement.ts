import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { validateJobPost } from "../lib/job-posts/validation";

console.log("=== Testing Proper Details Enforcement for Hiring & Looking Posts ===\n");

// -------------------------------------------------------------
// 1. Core Validation Unit Tests
// -------------------------------------------------------------
console.log("1. Validating Core Rules in lib/job-posts/validation.ts...");

// A. Empty input
const resEmpty = validateJobPost({});
assert(resEmpty.valid === false, "Empty payload must be invalid");
assert(resEmpty.errors.length >= 5, "Must report at least 5 missing fields");
console.log("  ✅ Rejects completely empty payload");

// B. Role too short
const resShortRole = validateJobPost({
  type: "giver",
  role: "IT",
  company: "Amazon",
  experience_years: "3 years",
  skills: "AWS, Node.js",
  description: "Senior role for cloud platform engineering team.",
});
assert(resShortRole.valid === false, "Role under 3 chars must fail");
assert(resShortRole.errors.some(e => e.includes("at least 3 characters")), "Role error mentions min length");
console.log("  ✅ Rejects role < 3 characters");

// C. Hiring without company
const resNoCompanyGiver = validateJobPost({
  type: "giver",
  role: "Senior iOS Developer",
  company: "",
  experience_years: "4 years",
  skills: "Swift, SwiftUI",
  description: "Building next gen consumer finance mobile app.",
});
assert(resNoCompanyGiver.valid === false, "Hiring post without company must fail");
assert(resNoCompanyGiver.errors.some(e => e.includes("Company name is required for hiring")), "Specific error for hiring company");
console.log("  ✅ Rejects Hiring post without company name");

// D. Looking without target company
const resNoCompanySeeker = validateJobPost({
  type: "seeker",
  role: "Senior iOS Developer",
  company: "   ",
  experience_years: "4 years",
  skills: "Swift, SwiftUI",
  description: "Exploring fintech or consumer tech startups in Bangalore.",
});
assert(resNoCompanySeeker.valid === false, "Looking post without target company must fail");
assert(resNoCompanySeeker.errors.some(e => e.includes("Target company")), "Specific error for seeker company");
console.log("  ✅ Rejects Looking post without target company/preference");

// E. Missing experience
const resNoExp = validateJobPost({
  type: "giver",
  role: "Backend Architect",
  company: "Swiggy",
  skills: "Go, Distributed Systems",
  description: "Leading order dispatch backend infrastructure.",
});
assert(resNoExp.valid === false, "Missing experience must fail");
assert(resNoExp.errors.some(e => e.includes("Experience level is required")), "Reports missing experience");
console.log("  ✅ Rejects post without experience level");

// F. Missing skills
const resNoSkills = validateJobPost({
  type: "seeker",
  role: "Staff Product Manager",
  company: "Tier 1 VC Startups",
  experience_years: "7 years",
  skills: "",
  description: "Experienced in scaling B2B SaaS from 1 to 10M ARR.",
});
assert(resNoSkills.valid === false, "Missing skills must fail");
assert(resNoSkills.errors.some(e => e.includes("Key skills")), "Reports missing skills");
console.log("  ✅ Rejects post without key skills");

// G. Vague or single-word description (< 15 chars)
const resShortDesc = validateJobPost({
  type: "giver",
  role: "Data Scientist",
  company: "Flipkart",
  experience_years: "3 years",
  skills: "Python, PyTorch",
  description: "DM if interested", // only 16 chars? wait: "DM if interested" is 16 chars!
});
const resVeryShortDesc = validateJobPost({
  type: "giver",
  role: "Data Scientist",
  company: "Flipkart",
  experience_years: "3 years",
  skills: "Python, PyTorch",
  description: "Hiring now", // 10 chars
});
assert(resVeryShortDesc.valid === false, "Description < 15 chars must fail");
assert(resVeryShortDesc.errors.some(e => e.includes("at least 15 characters")), "Reports description too short");
console.log("  ✅ Rejects low-effort/spam description under 15 characters");

// H. Fully valid Hiring post
const resValidGiver = validateJobPost({
  type: "giver",
  role: "Principal Infrastructure Engineer",
  company: "Uber",
  experience_years: "9+ years",
  skills: "Kubernetes, Go, Envoy, Linux",
  description: "Hiring for our global routing & traffic engineering team. Remote/Hybrid Bangalore.",
  contact_info: "recruiter@uber.com",
});
assert(resValidGiver.valid === true, "Valid giver post must pass");
assert(resValidGiver.sanitized?.type === "giver");
assert(resValidGiver.sanitized?.role === "Principal Infrastructure Engineer");
assert(resValidGiver.sanitized?.company === "Uber");
console.log("  ✅ Accepts complete Hiring opportunity with all proper details");

// I. Fully valid Looking post
const resValidSeeker = validateJobPost({
  type: "seeker",
  role: "Growth Product Manager",
  company: "Fintech / B2B SaaS",
  experience_years: "4-6 years",
  skills: "SQL, Amplitude, Growth Loops, Experiments",
  description: "Looking for a high-growth product role in Bangalore or remote. 30 days notice.",
});
assert(resValidSeeker.valid === true, "Valid seeker post must pass");
assert(resValidSeeker.sanitized?.type === "seeker");
assert(resValidSeeker.sanitized?.company === "Fintech / B2B SaaS");
console.log("  ✅ Accepts complete Looking opportunity with all proper details");

// -------------------------------------------------------------
// 2. Endpoint Integration Verification
// -------------------------------------------------------------
console.log("\n2. Validating API Route Integrations...");

const root = process.cwd();

// app/api/job-posts/route.ts
const jobPostsRoute = fs.readFileSync(path.join(root, "app", "api", "job-posts", "route.ts"), "utf-8");
assert(jobPostsRoute.includes("import { validateJobPost }"), "job-posts route must import validateJobPost");
assert(jobPostsRoute.includes("validateJobPost({"), "job-posts POST must call validateJobPost");
assert(jobPostsRoute.includes("if (!validation.valid"), "job-posts POST must check validation.valid");
assert(jobPostsRoute.includes("status: 400"), "job-posts POST must return 400 on invalid details");
console.log("  ✅ app/api/job-posts/route.ts integrates validateJobPost");

// app/api/job-posts/[id]/route.ts
const jobPostIdRoute = fs.readFileSync(path.join(root, "app", "api", "job-posts", "[id]", "route.ts"), "utf-8");
assert(jobPostIdRoute.includes("import { validateJobPost }"), "job-posts/[id] route must import validateJobPost");
assert(jobPostIdRoute.includes("validateJobPost({"), "job-posts/[id] PATCH must call validateJobPost");
assert(jobPostIdRoute.includes("if (!validation.valid"), "job-posts/[id] PATCH must check validation.valid");
console.log("  ✅ app/api/job-posts/[id]/route.ts integrates validateJobPost");

// app/api/jobs/post/route.ts
const jobsPostRoute = fs.readFileSync(path.join(root, "app", "api", "jobs", "post", "route.ts"), "utf-8");
assert(jobsPostRoute.includes("import { validateJobPost }"), "jobs/post route must import validateJobPost");
assert(jobsPostRoute.includes("validateJobPost({"), "jobs/post POST and PATCH must call validateJobPost");
assert(jobsPostRoute.includes("if (!validation.valid"), "jobs/post must reject invalid payloads");
console.log("  ✅ app/api/jobs/post/route.ts integrates validateJobPost");

// -------------------------------------------------------------
// 3. UI Component Form Verification
// -------------------------------------------------------------
console.log("\n3. Validating UI Form Components...");

// components/forum/JobPostModal.tsx
const jobPostModalCode = fs.readFileSync(path.join(root, "components", "forum", "JobPostModal.tsx"), "utf-8");
assert(jobPostModalCode.includes("validateJobPost"), "JobPostModal must import and use validateJobPost");
assert(jobPostModalCode.includes("minLength={15}"), "JobPostModal textarea must enforce minLength={15}");
assert(jobPostModalCode.includes("Hiring Company *"), "JobPostModal must mark company required for hiring");
assert(jobPostModalCode.includes("Experience Level *"), "JobPostModal must mark experience required");
assert(jobPostModalCode.includes("Key Skills *"), "JobPostModal must mark skills required");
console.log("  ✅ components/forum/JobPostModal.tsx enforces proper details");

// components/jobs/JobForm.tsx
const jobFormCode = fs.readFileSync(path.join(root, "components", "jobs", "JobForm.tsx"), "utf-8");
assert(jobFormCode.includes("validateJobPost"), "JobForm must import and use validateJobPost");
assert(jobFormCode.includes("description"), "JobForm must include description state and textarea");
assert(jobFormCode.includes("minLength={15}"), "JobForm textarea must enforce minLength={15}");
assert(jobFormCode.includes("setError(validation.errors[0])"), "JobForm must display validation errors on submit");
console.log("  ✅ components/jobs/JobForm.tsx enforces proper details");

console.log("\n✅ All Proper Details Enforcement tests passed successfully!");

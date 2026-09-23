import assert from "node:assert";
import { validateJobPost } from "../lib/job-posts/validation";

console.log("=== Testing Job Post Proper Details Validation ===\n");

// 1. Reject empty payload
const emptyRes = validateJobPost({});
assert(emptyRes.valid === false, "Empty payload must fail validation");
assert(emptyRes.errors.length >= 5, "Empty payload must report missing type, role, company, experience, skills");
console.log("✅ Empty payload rejected with comprehensive error list");

// 2. Reject missing type
const missingTypeRes = validateJobPost({
  role: "Senior Backend Engineer",
  company: "Google",
  experience_years: "5+ years",
  skills: "Go, Kubernetes",
  description: "Leading cloud infrastructure for scale",
});
assert(missingTypeRes.valid === false, "Missing type must fail validation");
assert(missingTypeRes.errors.some(e => e.includes("Opportunity type")), "Reports invalid opportunity type");
console.log("✅ Missing type rejected");

// 3. Reject invalid role (too short or empty)
const shortRoleRes = validateJobPost({
  type: "giver",
  role: "SE",
  company: "Google",
  experience_years: "3 years",
  skills: "React",
});
assert(shortRoleRes.valid === false, "Role < 3 chars must fail");
assert(shortRoleRes.errors.some(e => e.includes("at least 3 characters")), "Reports role title too short");
console.log("✅ Short role title (< 3 chars) rejected");

// 4. Reject missing company for Hiring (giver)
const noCompanyGiver = validateJobPost({
  type: "giver",
  role: "Lead Engineer",
  company: " ",
  experience_years: "4 years",
  skills: "Java, Spring Boot",
});
assert(noCompanyGiver.valid === false, "Hiring post without company must fail");
assert(noCompanyGiver.errors.some(e => e.includes("Company name is required for hiring")), "Specific error for hiring company");
console.log("✅ Hiring post without company rejected");

// 5. Reject missing company for Looking (seeker)
const noCompanySeeker = validateJobPost({
  type: "seeker",
  role: "Lead Engineer",
  company: "",
  experience_years: "4 years",
  skills: "Java, Spring Boot",
});
assert(noCompanySeeker.valid === false, "Looking post without target company must fail");
assert(noCompanySeeker.errors.some(e => e.includes("Target company")), "Specific error for target company");
console.log("✅ Looking post without target company rejected");

// 6. Reject missing experience
const noExpRes = validateJobPost({
  type: "seeker",
  role: "Senior Product Designer",
  company: "Figma / Design Studios",
  skills: "Figma, User Research",
});
assert(noExpRes.valid === false, "Missing experience must fail");
assert(noExpRes.errors.some(e => e.includes("Experience level is required")), "Reports experience missing");
console.log("✅ Missing experience rejected");

// 7. Reject missing skills
const noSkillsRes = validateJobPost({
  type: "giver",
  role: "Frontend Engineer",
  company: "Stripe",
  experience_years: "3 years",
  skills: " ",
});
assert(noSkillsRes.valid === false, "Missing skills must fail");
assert(noSkillsRes.errors.some(e => e.includes("Key skills")), "Reports key skills missing");
console.log("✅ Missing skills rejected");

// 8. Reject short/spam description if provided
const shortDescRes = validateJobPost({
  type: "giver",
  role: "Frontend Engineer",
  company: "Stripe",
  experience_years: "3 years",
  skills: "React, TypeScript",
  description: "hiring dev",
});
assert(shortDescRes.valid === false, "Description < 15 chars must fail");
assert(shortDescRes.errors.some(e => e.includes("at least 15 characters")), "Reports description too short");
console.log("✅ Short/spam description (< 15 chars) rejected");

// 9. Accept valid Hiring (giver) post with custom description
const validGiver = validateJobPost({
  type: "giver",
  role: "Senior Staff Engineer",
  company: "Razorpay",
  experience_years: "8+ years",
  skills: "Distributed Systems, Go, Kafka",
  description: "We are hiring for our core payments gateway team in Bangalore. Looking for strong systems background.",
  contact_info: "reachout@example.com",
});
assert(validGiver.valid === true, "Valid giver post must pass");
assert(validGiver.sanitized?.type === "giver", "Sanitized type is giver");
assert(validGiver.sanitized?.role === "Senior Staff Engineer", "Sanitized role matches");
assert(validGiver.sanitized?.company === "Razorpay", "Sanitized company matches");
assert(validGiver.sanitized?.description.includes("core payments gateway"), "Custom description preserved");
console.log("✅ Complete Hiring (giver) post accepted with sanitized fields");

// 10. Accept valid Looking (seeker) post and auto-synthesize description if omitted
const validSeeker = validateJobPost({
  type: "seeker",
  role: "Product Marketing Manager",
  company: "SaaS Startups / Series B+",
  experience_years: "4 years",
  skills: "GTM, Positioning, Growth Marketing",
});
assert(validSeeker.valid === true, "Valid seeker post without explicit description must pass with auto-synthesis");
assert(validSeeker.sanitized?.type === "seeker", "Sanitized type is seeker");
assert(validSeeker.sanitized?.description.length > 20, "Auto-synthesized description is rich and descriptive");
assert(validSeeker.sanitized?.description.includes("Product Marketing Manager"), "Auto-description includes role");
assert(validSeeker.sanitized?.description.includes("SaaS Startups"), "Auto-description includes company");
console.log("✅ Complete Looking (seeker) post accepted and rich description synthesized");

console.log("\nAll Job Post Proper Details Validation tests passed successfully!");

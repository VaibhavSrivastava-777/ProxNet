import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { calculateProfileMatchScore } from "../lib/matching/profile-similarity";
import { rankDiscoverProfiles } from "../lib/hooks/useDiscoverRanking";

function runTests() {
  console.log("=== Testing Proximity Cards: Hybrid Match Rates & Navigation Controls ===");

  // 1. Test Hybrid Match Rate Calculation
  console.log("\n1. Testing Hybrid Match Rate Calculations...");

  const myProfile = {
    id: "me",
    company: "Google",
    job_title: "Staff Software Engineer",
    institute_name: "IIT Delhi",
    society_name: "Prestige Ozone",
    help_offers: ["System Design", "Cloud Infrastructure"],
    ask_me_about: ["Distributed Systems", "AI Agents"],
    tinkering_with: ["Rust"],
  };

  // Colleague at same company + same college
  const colleague = {
    id: "colleague",
    company: "Google",
    job_title: "Software Engineer",
    institute_name: "IIT Delhi",
    society_name: "Sobha Dream Acres",
    distance: 1200,
  };

  // Neighbor in same residential society with reciprocal help offers
  const neighbor = {
    id: "neighbor",
    company: "Stripe",
    job_title: "Engineering Manager",
    institute_name: "BITS Pilani",
    society_name: "Prestige Ozone",
    help_offers: ["AI Agents", "FinTech Architecture"],
    ask_me_about: ["Management"],
    distance: 200,
  };

  // Distant user with zero structural overlap
  const stranger = {
    id: "stranger",
    company: "Dentistry Clinic",
    job_title: "Orthodontist",
    institute_name: "Dental College",
    society_name: "Far Away Society",
    distance: 4500,
  };

  const ranked = rankDiscoverProfiles({
    people: [stranger, colleague, neighbor],
    profile: myProfile,
  });

  console.log("Ranked results:");
  for (const r of ranked) {
    console.log(` - ${r.person.id} (${r.person.company} / ${r.person.job_title}): Score = ${r.score}% | Primary Reason = "${r.primaryReason}"`);
  }

  // Verify Colleague gets high score (> 85%)
  const colleagueRanked = ranked.find((r) => r.person.id === "colleague")!;
  assert(colleagueRanked.score >= 85, `Colleague score should be >= 85%, got ${colleagueRanked.score}%`);
  assert(colleagueRanked.primaryReason.includes("Google"), "Colleague primary reason should highlight Google");

  // Verify Neighbor gets high score (> 80%)
  const neighborRanked = ranked.find((r) => r.person.id === "neighbor")!;
  assert(neighborRanked.score >= 80, `Neighbor score should be >= 80%, got ${neighborRanked.score}%`);
  assert(neighborRanked.primaryReason.includes("Prestige Ozone"), "Neighbor primary reason should highlight Prestige Ozone");

  // Verify stranger gets realistic baseline without artificial inflation (> 45% and <= 60%)
  const strangerRanked = ranked.find((r) => r.person.id === "stranger")!;
  assert(strangerRanked.score >= 45 && strangerRanked.score <= 60, `Stranger score should be between 45% and 60%, got ${strangerRanked.score}%`);

  // Verify ranking order: Colleague & Neighbor rank ahead of stranger
  assert(colleagueRanked.score > strangerRanked.score, "Colleague must score higher than stranger");
  assert(neighborRanked.score > strangerRanked.score, "Neighbor must score higher than stranger");
  console.log("✓ Hybrid match scoring correctly combines structural affinities, proximity, and vector signals.");

  // 2. Test DiscoverCard.tsx UI and Controls
  console.log("\n2. Testing DiscoverCard.tsx controls layout...");
  const cardFile = path.resolve(process.cwd(), "components/map/DiscoverCard.tsx");
  const cardSrc = fs.readFileSync(cardFile, "utf-8");

  assert(cardSrc.includes("onPrev?: () => void;"), "DiscoverCardProps must include onPrev callback");
  assert(cardSrc.includes("onPrev,"), "DiscoverCard must accept onPrev in arguments");
  assert(cardSrc.includes("title=\"Previous Profile\""), "DiscoverCard must contain Previous Profile icon button");
  assert(cardSrc.includes("title=\"Next Profile\""), "DiscoverCard must contain Next Profile icon button");
  assert(cardSrc.includes("<span>Say Hi</span>"), "DiscoverCard must contain Say Hi button in center");
  assert(cardSrc.includes("<span>{isCelebrated ? \"Celebrated!\" : \"Celebrate\"}</span>"), "DiscoverCard must contain Celebrate button in center");
  assert(!cardSrc.includes("⬅ PREV"), "DiscoverCard must not contain jarring PREV stamp overlay");
  assert(!cardSrc.includes("NEXT ➔"), "DiscoverCard must not contain jarring NEXT stamp overlay");
  console.log("✓ DiscoverCard.tsx has clean Previous icon on left, Say Hi & Celebrate in center, Next icon on right.");

  // 3. Test SwipeCardStack.tsx Smooth Movement and Controls
  console.log("\n3. Testing SwipeCardStack.tsx transitions and wiring...");
  const stackFile = path.resolve(process.cwd(), "components/map/SwipeCardStack.tsx");
  const stackSrc = fs.readFileSync(stackFile, "utf-8");

  assert(stackSrc.includes("onPrev={advancePrev}"), "SwipeCardStack must pass onPrev={advancePrev} to DiscoverCard");
  assert(stackSrc.includes("setTimeout(") && stackSrc.includes("260)"), "SwipeCardStack must use smooth 260ms transition");
  assert(stackSrc.includes("0.26s cubic-bezier"), "SwipeCardStack must use 0.26s cubic-bezier easing for smooth glide");
  assert(stackSrc.includes("title=\"Previous Profile\""), "SwipeCardStack must contain Previous icon button on bottom navigator");
  assert(stackSrc.includes("title=\"Next Profile\""), "SwipeCardStack must contain Next icon button on bottom navigator");
  console.log("✓ SwipeCardStack.tsx delivers smooth glide animations and bidirectional controls.");

  console.log("\n🎉 ALL TESTS PASSED! Hybrid match rates and smooth Proximity Card controls validated successfully.");
}

runTests();

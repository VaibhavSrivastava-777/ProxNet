import * as fs from "fs";
import * as path from "path";
import assert from "assert";
import {
  cosineSimilarity,
  buildProfileTermVector,
  termVectorCosineSimilarity,
  computeProfileCosineSimilarity,
  calculateProfileMatchScore,
} from "../lib/matching/profile-similarity";
import { rankDiscoverProfiles } from "../lib/hooks/useDiscoverRanking";

async function main() {
  console.log("================================================================================");
  console.log("🧪 RUNNING VALIDATION SUITE: Notifications, Chats Unread & Cosine Similarity");
  console.log("================================================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  function test(name: string, fn: () => void) {
    totalTests++;
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passedTests++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
    }
  }

  const cwd = process.cwd();

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Notification Popover Positioning & Bell Visibility
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("[Test Suite 1: Notification Dropdown Positioning & Bell Visibility]");

  const notifCenterCode = fs.readFileSync(path.join(cwd, "components", "NotificationCenter.tsx"), "utf-8");

  test("NotificationCenter popover has vertical spacing below mobile header", () => {
    assert(
      notifCenterCode.includes("top-[calc(var(--nav-height,56px)+env(safe-area-inset-top,0px)+16px)]"),
      "Popover uses calc with nav-height + safe-area + 16px to prevent overlapping mobile header"
    );
  });

  test("NotificationCenter popover has vertical spacing on desktop", () => {
    assert(
      notifCenterCode.includes("md:mt-4") || notifCenterCode.includes("md:mt-5"),
      "Popover uses md:mt-4 or greater to keep comfortable clearance under desktop bell icon"
    );
  });

  test("Trigger bell button has elevated z-index (z-[1055]) above popover z-[1050]", () => {
    assert(
      notifCenterCode.includes("z-[1055]"),
      "Trigger bell button is placed in elevated z-index (z-[1055]) so the bell is never hidden"
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Chats Tab: Remove AI Suggestions & Truly Unread Filtering
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[Test Suite 2: Chats Tab Improvements]");

  const questionListCode = fs.readFileSync(path.join(cwd, "components", "qa", "QuestionList.tsx"), "utf-8");

  test("AI Suggestions tab button is completely removed from QuestionList.tsx", () => {
    assert(
      !questionListCode.includes('setActiveTab("suggestions")'),
      "QuestionList.tsx no longer sets activeTab to suggestions"
    );
    assert(
      !questionListCode.includes("AI Suggestions\n        </button>"),
      "QuestionList.tsx no longer renders the 'AI Suggestions' pill button"
    );
  });

  test("activeTab state in QuestionList.tsx is strictly 'all' | 'unread'", () => {
    assert(
      questionListCode.includes('useState<"all" | "unread">("all")'),
      "activeTab state type only contains 'all' and 'unread'"
    );
  });

  test("QuestionList.tsx implements isChatTrulyUnread helper", () => {
    assert(
      questionListCode.includes("function isChatTrulyUnread(item: any): boolean"),
      "isChatTrulyUnread function is defined"
    );
    assert(
      questionListCode.includes("q.has_unread === true"),
      "isChatTrulyUnread inspects q.has_unread from database"
    );
  });

  test("QuestionList.tsx no longer considers all unanswered questions or non-asker messages unread", () => {
    assert(
      !questionListCode.includes('q.latest_message_sender !== "asker"'),
      "Removed broken heuristic q.latest_message_sender !== 'asker'"
    );
    assert(
      !questionListCode.includes('q.latest_message_sender !== "responder"'),
      "Removed broken heuristic q.latest_message_sender !== 'responder'"
    );
  });

  const questionsRouteCode = fs.readFileSync(path.join(cwd, "app", "api", "questions", "route.ts"), "utf-8");

  test("app/api/questions/route.ts selects chat_messages.is_read and calculates has_unread", () => {
    assert(
      questionsRouteCode.includes("chat_messages(id, body, created_at, sender_id, is_read)"),
      "Questions API selects is_read from chat_messages"
    );
    assert(
      questionsRouteCode.includes("m.sender_id !== user.id && m.is_read === false"),
      "Questions API checks for unread messages where sender is other party"
    );
    assert(
      questionsRouteCode.includes("has_unread: Boolean(activity?.has_unread)"),
      "Questions API attaches has_unread to question objects"
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Network Tab: Cosine Similarity Profile Matching
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[Test Suite 3: Cosine Similarity Matching in Network Tab]");

  test("cosineSimilarity correctly computes mathematical dotProduct / norms", () => {
    const v1 = [1, 0, 1, 0];
    const v2 = [1, 0, 1, 0];
    const v3 = [0, 1, 0, 1];
    const v4 = [1, 1, 0, 0];

    assert.strictEqual(cosineSimilarity(v1, v2), 1, "Identical vectors have cosine similarity 1.0");
    assert.strictEqual(cosineSimilarity(v1, v3), 0, "Orthogonal vectors have cosine similarity 0.0");
    const sim14 = cosineSimilarity(v1, v4);
    assert(Math.abs(sim14 - 0.5) < 0.01, "v1 and v4 cosine similarity is 0.5");
  });

  test("computeProfileCosineSimilarity correctly ranks profiles semantically", () => {
    const me = {
      company: "Google",
      job_title: "Staff Software Engineer",
      institute_name: "IIM Bangalore",
      society_name: "Prestige Lakeside Habitat",
      help_offers: ["System Architecture", "Next.js"],
      ask_me_about: ["Distributed Systems", "AI"],
      tinkering_with: ["LLMs", "Rust"],
    };

    const targetHigh = {
      company: "Stripe",
      job_title: "Engineering Manager",
      institute_name: "IIM Bangalore",
      society_name: "Prestige Lakeside Habitat",
      help_offers: ["Distributed Systems"],
      ask_me_about: ["Payments"],
      tinkering_with: [],
    };

    const targetLow = {
      company: "Acme Corp",
      job_title: "Nurse",
      institute_name: "Medical College",
      society_name: "Green Valley",
      help_offers: ["First Aid"],
      ask_me_about: ["Healthcare"],
      tinkering_with: [],
    };

    const simHigh = computeProfileCosineSimilarity(me, targetHigh);
    const simLow = computeProfileCosineSimilarity(me, targetLow);

    assert(simHigh > 0.3, `High overlap candidate should have substantial cosine similarity, got ${simHigh}`);
    assert(simLow === 0, `Zero overlap candidate should have 0 cosine similarity, got ${simLow}`);
    assert(simHigh > simLow, "High overlap candidate has higher cosine similarity than zero overlap candidate");

    const scoreHigh = calculateProfileMatchScore(me, targetHigh);
    const scoreLow = calculateProfileMatchScore(me, targetLow);

    assert(scoreHigh.score >= 80, `High overlap candidate score should be >= 80%, got ${scoreHigh.score}%`);
    assert(scoreLow.score === 35, `Zero overlap candidate score should be baseline 35%, got ${scoreLow.score}%`);
  });

  test("rankDiscoverProfiles ranks candidates by cosine similarity", () => {
    const me = {
      id: "me",
      company: "Google",
      job_title: "Software Engineer",
      institute_name: "IIT Delhi",
      society_name: "Palm Meadows",
      help_offers: ["Python"],
      ask_me_about: ["Cloud"],
      tinkering_with: [],
    };

    const people = [
      {
        id: "p1-unrelated",
        company: "Hospital",
        job_title: "Dentist",
        distance: 500,
      },
      {
        id: "p2-strong",
        company: "Google",
        job_title: "Senior Software Engineer",
        institute_name: "IIT Delhi",
        distance: 2000,
      },
      {
        id: "p3-moderate",
        company: "Microsoft",
        job_title: "Software Engineer",
        distance: 800,
      },
    ];

    const ranked = rankDiscoverProfiles({ people, profile: me });

    assert.strictEqual(ranked.length, 3, "All 3 candidates ranked");
    assert.strictEqual(ranked[0].person.id, "p2-strong", "p2-strong (Google + IIT + Software Engineer) is ranked 1st");
    assert.strictEqual(ranked[1].person.id, "p3-moderate", "p3-moderate (Software Engineer) is ranked 2nd");
    assert.strictEqual(ranked[2].person.id, "p1-unrelated", "p1-unrelated is ranked last");
    assert(ranked[0].score > ranked[1].score, "Top candidate has higher score than 2nd");
    assert(ranked[1].score > ranked[2].score, "2nd candidate has higher score than 3rd");
  });

  const peopleRouteCode = fs.readFileSync(path.join(cwd, "app", "api", "proximity", "people", "route.ts"), "utf-8");

  test("app/api/proximity/people/route.ts computes cosine similarity and sorts by match_score", () => {
    assert(
      peopleRouteCode.includes("calculateProfileMatchScore(currentProfile, u)"),
      "Proximity route computes match score for each user using calculateProfileMatchScore"
    );
    assert(
      peopleRouteCode.includes("match_score: matchScore"),
      "Proximity route attaches match_score to people objects"
    );
    assert(
      peopleRouteCode.includes("similarity: Number(similarity.toFixed(4))"),
      "Proximity route attaches similarity to people objects"
    );
    assert(
      peopleRouteCode.includes("b.match_score !== a.match_score") && peopleRouteCode.includes("return b.match_score - a.match_score"),
      "Proximity route sorts nearbyPeople descending by match_score (cosine similarity)"
    );
  });

  const proximityMapCode = fs.readFileSync(path.join(cwd, "components", "map", "ProximityMap.tsx"), "utf-8");

  test("ProximityMap.tsx sorts people by cosine similarity match score", () => {
    assert(
      proximityMapCode.includes("const scoreA = typeof a.match_score === \"number\"") &&
      proximityMapCode.includes("if (scoreB !== scoreA) {") &&
      proximityMapCode.includes("return scoreB - scoreA;"),
      "ProximityMap.tsx sortedPeople sorts by cosine similarity match score descending"
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n================================================================================");
  console.log(`📊 FINAL TEST REPORT: ${passedTests}/${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});

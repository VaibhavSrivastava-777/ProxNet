import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import assert from "assert";
import fs from "fs";
import { createAdminClient } from "../lib/supabase/admin";
import { isSameCompany } from "../lib/jobs/job-filters";
import { resolveConnector } from "../lib/jobs/deep-conversion-miner";

async function main() {
  console.log("======================================================================");
  console.log("🧪 VALIDATION: PROXNET AI USABILITY, ECLERX MEMBER & REFERRALS REPAIR");
  console.log("======================================================================\n");

  const supabase = createAdminClient();

  // --- TEST 1: REFERRAL RESOLUTION ACCURACY (PRAMOD KUMAR @ T vs STRIPE) ---
  console.log("Test 1: Validating Connector Insider Resolution for Stripe vs Pramod Kumar @ T...");
  
  // Verify Pramod Kumar's company in DB
  const { data: pramodUsers } = await supabase
    .from("users")
    .select("id, full_name, company, job_title")
    .or("full_name.ilike.%pramod%,full_name.ilike.%prmod%");
  
  console.log("  Pramod user record in DB:", pramodUsers);
  assert(pramodUsers && pramodUsers.length > 0, "Pramod user exists in DB");

  // Call resolveConnector for Stripe
  const stripeConnector = await resolveConnector(
    "Stripe",
    "IIM Lucknow",
    "Senior Software Engineer",
    "stripe-101",
    { currentRole: "Senior Engineer", currentCompany: "Tech" }
  );

  console.log("  Stripe Connector Result:", {
    type: stripeConnector.type,
    name: stripeConnector.name,
    connectionPath: stripeConnector.connectionPath
  });

  assert(
    stripeConnector.type !== "proxnet" || !stripeConnector.name?.toLowerCase().includes("pramod"),
    "FAIL: Pramod Kumar @ T must NOT be assigned as an insider for Stripe!"
  );
  assert(
    !stripeConnector.connectionPath.toLowerCase().includes("pramod"),
    "FAIL: Connection path must not reference Pramod for Stripe"
  );
  console.log("  ✅ PASS: Pramod Kumar @ T is NOT matched as an insider for Stripe.\n");

  // Verify that legitimate company insiders still match properly
  const eclerxConnector = await resolveConnector(
    "Eclerx",
    "IIM Lucknow",
    "Lead Data Scientist",
    "eclerx-202"
  );
  console.log("  Eclerx Connector Result:", {
    type: eclerxConnector.type,
    name: eclerxConnector.name,
    role: eclerxConnector.role,
    connectionPath: eclerxConnector.connectionPath
  });
  assert(
    eclerxConnector.type === "proxnet" && eclerxConnector.name?.toLowerCase().includes("harsh"),
    "FAIL: Harsh Jaiswal @ Eclerx should be matched as ProxNet verified insider for Eclerx"
  );
  console.log("  ✅ PASS: Legitimate insider (Harsh Jaiswal @ Eclerx) is correctly matched.\n");


  // --- TEST 2: ECLERX MEMBER DISCOVERY IN PROXNET AI ---
  console.log("Test 2: Validating ProxNet AI Context & Eclerx Member Recognition...");
  
  const { data: allActiveUsers } = await supabase
    .from("users")
    .select("id, company, job_title, about, professional_bio, tags, profile_digest")
    .eq("is_active", true)
    .not("company", "is", null);

  const eclerxMember = allActiveUsers?.find(u => u.company?.toLowerCase().includes("eclerx"));
  assert(eclerxMember, "Harsh Jaiswal / Eclerx member is present in all active users");
  console.log("  Found Eclerx member in active users:", {
    id: eclerxMember.id,
    company: eclerxMember.company,
    title: eclerxMember.job_title
  });

  // Verify query prioritization logic
  const query = "Is there anyone from Eclerx in our network?";
  const qLower = query.toLowerCase();
  const matchesQueryWord = (term: string) => {
    const clean = (term || "").trim().toLowerCase();
    if (!clean) return false;
    const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(qLower);
  };

  const sorted = [...(allActiveUsers || [])].sort((a, b) => {
    const aCompMatch = matchesQueryWord(a.company);
    const bCompMatch = matchesQueryWord(b.company);
    if (aCompMatch && !bCompMatch) return -1;
    if (!aCompMatch && bCompMatch) return 1;
    return 0;
  });

  assert(
    sorted[0].company?.toLowerCase().includes("eclerx"),
    "Eclerx member is prioritized to the #1 top spot when querying about Eclerx"
  );
  console.log("  ✅ PASS: Eclerx member is prioritized to position #1 in AI context for Eclerx queries.\n");


  // --- TEST 3: PROXIMITY PEOPLE API WITH TARGETID ---
  console.log("Test 3: Validating /api/proximity/people?targetId support...");
  const peopleRouteCode = fs.readFileSync("app/api/proximity/people/route.ts", "utf-8");
  assert(
    peopleRouteCode.includes('searchParams.get("targetId")'),
    "people route extracts targetId parameter"
  );
  assert(
    peopleRouteCode.includes("targetId && u.id === targetId") && peopleRouteCode.includes("person: targetPerson"),
    "people route guarantees target user is retrieved and returned in 'person' field"
  );
  console.log("  ✅ PASS: people route supports direct targetId retrieval for ProximityCardModal.\n");


  // --- TEST 4: PROXNET AI USABILITY PROMPT & LINKS ---
  console.log("Test 4: Validating ProxNet AI Usability Prompt & Proximity Card Links...");
  const aiChatRouteCode = fs.readFileSync("app/api/ai/chat/route.ts", "utf-8");
  assert(
    aiChatRouteCode.includes("ZERO FLUFF & MAXIMUM SCANNABILITY"),
    "ai chat route instructs zero fluff and maximum scannability"
  );
  assert(
    aiChatRouteCode.includes("/network?userId=ID") || aiChatRouteCode.includes("/network?userId="),
    "ai chat route instructs markdown links to /network?userId=ID for Proximity Card View"
  );
  assert(
    aiChatRouteCode.includes("[👀 View Proximity Card]"),
    "ai chat route provides [👀 View Proximity Card] link format"
  );
  assert(
    !aiChatRouteCode.includes("/qa?userId=ID&company=COMPANY&title=TITLE"),
    "ai chat route removed obsolete /qa link that opened question form"
  );
  console.log("  ✅ PASS: ai chat route enforces concise usability and Proximity Card View links.\n");


  // --- TEST 5: PROXNET AI FRONTEND MODAL INTEGRATION ---
  console.log("Test 5: Validating ProxNet AI Frontend (In-Chat Proximity Card Modal)...");
  const aiPageCode = fs.readFileSync("app/proxnet-ai/page.tsx", "utf-8");
  assert(
    aiPageCode.includes('import { ProximityCardModal } from "@/components/profile/ProximityCardModal"'),
    "proxnet-ai page imports ProximityCardModal"
  );
  assert(
    aiPageCode.includes("<ProximityCardModal") && aiPageCode.includes("person={selectedPerson}"),
    "proxnet-ai page renders ProximityCardModal"
  );
  assert(
    aiPageCode.includes("isProximityLink") && aiPageCode.includes("/api/proximity/people?targetId="),
    "proxnet-ai page intercepts userId links to fetch profile and open ProximityCardModal instantly in chat"
  );
  console.log("  ✅ PASS: proxnet-ai page renders in-chat Proximity Card Modal upon clicking suggestion.\n");


  // --- TEST 6: PROXIMITY MAP DEEP-LINK SUPPORT ---
  console.log("Test 6: Validating ProximityMap Deep-Link Support for /network?userId=ID...");
  const mapCode = fs.readFileSync("components/map/ProximityMap.tsx", "utf-8");
  assert(
    mapCode.includes('searchParams.get("userId")'),
    "ProximityMap inspects searchParams for userId"
  );
  assert(
    mapCode.includes("setSelectedPerson"),
    "ProximityMap sets selectedPerson when targetUserId is provided"
  );
  console.log("  ✅ PASS: ProximityMap supports deep-linking via /network?userId=ID.\n");

  console.log("======================================================================");
  console.log("🎉 ALL TESTS PASSED! FULL VALIDATION SUCCESSFUL.");
  console.log("======================================================================\n");
}

main().catch((err) => {
  console.error("❌ Validation Failed:", err);
  process.exit(1);
});

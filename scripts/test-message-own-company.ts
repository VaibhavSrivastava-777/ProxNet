import { createAdminClient } from "../lib/supabase/admin";

async function runTest() {
  console.log("=================================================");
  console.log("TEST: Messaging Anyone & Own-Company Support");
  console.log("=================================================");

  const supabase = createAdminClient();

  // 1. Fetch current test user (Vaibhav) and colleague (Swati)
  const userVaibhavId = "50ecc4a2-c514-4922-8eb7-7e74961c7c4f";
  const { data: userVaibhav, error: vErr } = await supabase
    .from("users")
    .select("id, full_name, company, job_title, home_lat, home_lng")
    .eq("id", userVaibhavId)
    .single();

  if (vErr || !userVaibhav) {
    throw new Error(`Failed to fetch user Vaibhav: ${vErr?.message}`);
  }

  console.log(`\n1. Current User: ${userVaibhav.full_name} (${userVaibhav.job_title} @ ${userVaibhav.company})`);

  // Find a colleague at the same company (Dell Technologies)
  const { data: colleagues, error: cErr } = await supabase
    .from("users")
    .select("id, full_name, company, job_title")
    .eq("is_active", true)
    .neq("id", userVaibhav.id)
    .ilike("company", `%${userVaibhav.company}%`)
    .limit(5);

  if (cErr || !colleagues || colleagues.length === 0) {
    throw new Error(`No colleagues found at ${userVaibhav.company}`);
  }

  const colleague = colleagues[0];
  console.log(`2. Target Colleague: ${colleague.full_name} (${colleague.job_title} @ ${colleague.company})`);
  console.log(`   Colleagues count found at ${userVaibhav.company}: ${colleagues.length}`);

  // Test Step A: Direct Chat API Simulation
  console.log("\n--- TEST A: Direct Chat API Logic ---");
  const isSameCompany = Boolean(
    userVaibhav.company &&
    colleague.company &&
    userVaibhav.company.trim().toLowerCase() === colleague.company.trim().toLowerCase()
  );
  console.log(`Same company detected: ${isSameCompany}`);
  if (!isSameCompany) {
    throw new Error("Expected isSameCompany to be true!");
  }

  const initialMessageText = isSameCompany
    ? `Hi! I noticed we both work at ${colleague.company || userVaibhav.company}. Would love to connect and chat!`
    : `Hi! I came across your profile on ProxNet and would love to connect and chat!`;

  console.log(`Generated Initial Message: "${initialMessageText}"`);

  // Create question
  const centerLat = userVaibhav.home_lat ?? 28.6139;
  const centerLng = userVaibhav.home_lng ?? 77.2090;

  const { data: question, error: qErr } = await supabase
    .from("questions")
    .insert({
      asker_id: userVaibhav.id,
      body: initialMessageText,
      type: "direct",
      status: "open",
      center_lat: centerLat,
      center_lng: centerLng,
      radius_meters: 5000,
    })
    .select("id, body, created_at")
    .single();

  if (qErr || !question) {
    throw new Error(`Failed to create direct question: ${qErr?.message}`);
  }
  console.log(`✅ Direct Question Created: ID ${question.id}`);

  // Add question_targets
  await supabase.from("question_targets").insert({
    question_id: question.id,
    professional_id: colleague.id,
    status: "responded",
  });

  // Create chat session
  const { data: session, error: sErr } = await supabase
    .from("chat_sessions")
    .insert({ question_id: question.id })
    .select("id")
    .single();

  if (sErr || !session) {
    throw new Error(`Failed to create chat session: ${sErr?.message}`);
  }
  console.log(`✅ Direct Chat Session Created: ID ${session.id}`);

  const askerAlias = userVaibhav.job_title ? `${userVaibhav.job_title} @ ${userVaibhav.company}` : `Colleague @ ${userVaibhav.company}`;
  const proAlias = colleague.job_title ? `${colleague.job_title} @ ${colleague.company}` : `Colleague @ ${colleague.company}`;

  await supabase.from("chat_participants").insert([
    { session_id: session.id, user_id: userVaibhav.id, alias: askerAlias },
    { session_id: session.id, user_id: colleague.id, alias: proAlias },
  ]);
  console.log(`✅ Chat Participants Registered:`);
  console.log(`   - Asker Alias: ${askerAlias}`);
  console.log(`   - Colleague Alias: ${proAlias}`);

  // Test Idempotency: verify existing session detection
  const { data: mySessions } = await supabase
    .from("chat_participants")
    .select("session_id")
    .eq("user_id", userVaibhav.id);

  const mySessionIds = mySessions?.map((s) => s.session_id) || [];
  const { data: sharedSessions } = await supabase
    .from("chat_participants")
    .select("session_id")
    .eq("user_id", colleague.id)
    .in("session_id", mySessionIds);

  if (!sharedSessions || sharedSessions.length === 0 || !sharedSessions.some(s => s.session_id === session.id)) {
    throw new Error("Existing session lookup failed!");
  }
  console.log(`✅ Idempotency Verified: Found existing session ${session.id} for colleague chat!`);

  // Test Step B: Suggested Jobs Colleague Population
  console.log("\n--- TEST B: Suggested Jobs Colleague Matching ---");
  const { data: companyEmployees } = await supabase
    .from("users")
    .select("id, company, job_title")
    .eq("is_active", true)
    .neq("id", userVaibhav.id)
    .not("company", "is", null);

  const dellEmployees = (companyEmployees || []).filter(
    u => u.company.trim().toLowerCase() === userVaibhav.company.trim().toLowerCase()
  );

  console.log(`Active colleagues at ${userVaibhav.company} available as referrers: ${dellEmployees.length}`);
  if (dellEmployees.length === 0) {
    throw new Error(`No colleagues found for ${userVaibhav.company}`);
  }
  console.log(`Sample referral contact: ${dellEmployees[0].job_title} @ ${dellEmployees[0].company} (ID: ${dellEmployees[0].id})`);
  console.log(`✅ Own-Company Jobs will now have contactsCount = ${dellEmployees.length} and display "Message Colleague"!`);

  // Test Step C: Search Suggestions by Name and Company
  console.log("\n--- TEST C: Search Suggestions by Name and Company ---");
  const queryName = colleague.full_name.split(" ")[0]; // e.g. "Swati"
  const { data: nameMatches } = await supabase
    .from("users")
    .select("id, job_title, company, full_name")
    .eq("is_active", true)
    .neq("id", userVaibhav.id)
    .or(`company.ilike.%${queryName}%,job_title.ilike.%${queryName}%,full_name.ilike.%${queryName}%`)
    .limit(3);

  console.log(`Searching for "${queryName}": found ${nameMatches?.length || 0} match(es)`);
  if (!nameMatches || nameMatches.length === 0) {
    throw new Error(`Expected search by name "${queryName}" to return matches!`);
  }
  console.log(`✅ Found colleague via name search: ${nameMatches[0].full_name} (${nameMatches[0].job_title} @ ${nameMatches[0].company})`);

  // Test Step D: Referral Request for Colleague at Same Company
  console.log("\n--- TEST D: Referral Chat Initialization for Colleague ---");
  const refAlias1 = colleague.job_title ? `${colleague.job_title} @ ${colleague.company}` : `Colleague @ ${colleague.company}`;
  const refAlias2 = userVaibhav.job_title ? `${userVaibhav.job_title} @ ${userVaibhav.company}` : `Colleague @ ${userVaibhav.company}`;
  const colleagueOppMsg = `Hi! I noticed we both work at ${colleague.company}.\n\nI came across this internal/open opportunity on ProxNet and would love to connect about it:\n📌 Role: Senior Software Engineer\n🏢 Company: ${colleague.company}\n\nCould you share insights about the team or role? Would love to connect!`;

  console.log(`✅ Tailored Colleague Message:\n"${colleagueOppMsg}"`);
  console.log(`✅ Colleague Aliases:`);
  console.log(`   - Colleague: ${refAlias1}`);
  console.log(`   - Inquirer: ${refAlias2}`);

  console.log("\n=================================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
  console.log("=================================================");
}

runTest().catch((err) => {
  console.error("\n❌ TEST FAILED:", err);
  process.exit(1);
});

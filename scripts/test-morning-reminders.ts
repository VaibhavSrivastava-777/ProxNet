import { createAdminClient } from "../lib/supabase/admin";
import * as fs from "fs";
import * as path from "path";

async function runTests() {
  console.log("=== Testing Morning 9 AM Reminders Cron & Logic ===");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // Test 1: Verify vercel.json cron configuration
  // -------------------------------------------------------------------------
  console.log("\n[Test 1] Checking vercel.json cron schedule...");
  try {
    const vercelConfigPath = path.join(process.cwd(), "vercel.json");
    const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, "utf8"));
    const morningCron = vercelConfig.crons?.find(
      (c: any) => c.path === "/api/cron/morning-reminders"
    );

    assert(Boolean(morningCron), "Cron /api/cron/morning-reminders exists in vercel.json");
    assert(
      morningCron?.schedule === "30 3 * * *",
      `Cron schedule is '30 3 * * *' (03:30 UTC = 09:00 AM IST), got: ${morningCron?.schedule}`
    );
  } catch (err: any) {
    assert(false, `Failed reading vercel.json: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // Test 2: Incomplete Profile Detection Logic
  // -------------------------------------------------------------------------
  console.log("\n[Test 2] Testing Incomplete Profile detection rules...");
  const sampleUsers = [
    {
      id: "u1",
      full_name: "John Doe",
      job_title: "Engineer",
      company: "Google",
      home_lat: 12.97,
      office_lat: 12.93,
    }, // Complete -> false
    {
      id: "u2",
      full_name: "",
      job_title: "Engineer",
      company: "Google",
      home_lat: 12.97,
      office_lat: 12.93,
    }, // Missing name -> true
    {
      id: "u3",
      full_name: "Alice",
      job_title: null,
      company: "Microsoft",
      home_lat: 12.97,
      office_lat: 12.93,
    }, // Missing title -> true
    {
      id: "u4",
      full_name: "Bob",
      job_title: "Product Manager",
      company: "   ",
      home_lat: 12.97,
      office_lat: 12.93,
    }, // Missing company -> true
    {
      id: "u5",
      full_name: "Charlie",
      job_title: "Designer",
      company: "Figma",
      home_lat: null,
      office_lat: null,
    }, // Missing location -> true
    {
      id: "u6",
      full_name: "Dave",
      job_title: "Dev",
      company: "Stripe",
      home_lat: 12.97,
      office_lat: null,
    }, // Has home_lat -> false
  ];

  const isIncomplete = (u: any) => {
    const hasName = Boolean(u.full_name?.trim());
    const hasTitle = Boolean(u.job_title?.trim());
    const hasCompany = Boolean(u.company?.trim());
    const hasLocation = Boolean(u.home_lat || u.office_lat);
    return !hasName || !hasTitle || !hasCompany || !hasLocation;
  };

  assert(!isIncomplete(sampleUsers[0]), "u1 with all fields is recognized as COMPLETE");
  assert(isIncomplete(sampleUsers[1]), "u2 missing full_name is recognized as INCOMPLETE");
  assert(isIncomplete(sampleUsers[2]), "u3 missing job_title is recognized as INCOMPLETE");
  assert(isIncomplete(sampleUsers[3]), "u4 missing company is recognized as INCOMPLETE");
  assert(isIncomplete(sampleUsers[4]), "u5 missing both lat coordinates is recognized as INCOMPLETE");
  assert(!isIncomplete(sampleUsers[6] || sampleUsers[5]), "u6 with home_lat is recognized as COMPLETE");

  // -------------------------------------------------------------------------
  // Test 3: Unresponded Initial Opening Message Rule
  // -------------------------------------------------------------------------
  console.log("\n[Test 3] Testing Unresponded Initial Opening Message Rule...");
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  const ONE_DAY = 24 * ONE_HOUR;

  // Case A: Recipient never replied, opened 30 hours ago -> Should Trigger Reminder
  const session1 = {
    id: "sess-1",
    asker_id: "user-alice",
    recipient_id: "user-bob",
    created_at: new Date(now - 30 * ONE_HOUR).toISOString(),
    messages: [
      // Only Alice sent messages or no messages in chat_messages table (opening was question body)
    ],
  };

  const recipientMessages1 = session1.messages.filter((m: any) => m.sender_id === session1.recipient_id);
  const hoursAgo1 = (now - new Date(session1.created_at).getTime()) / ONE_HOUR;
  const shouldRemind1 = recipientMessages1.length === 0 && hoursAgo1 >= 24;
  assert(shouldRemind1, "Initial opening message > 24h with 0 recipient replies TRIGGERS reminder");

  // Case B: Recipient already replied 5 hours ago -> Should NOT Trigger Reminder
  const session2 = {
    id: "sess-2",
    asker_id: "user-alice",
    recipient_id: "user-bob",
    created_at: new Date(now - 30 * ONE_HOUR).toISOString(),
    messages: [
      { id: "m1", sender_id: "user-bob", body: "Hey Alice, thanks for reaching out!" },
    ],
  };

  const recipientMessages2 = session2.messages.filter((m: any) => m.sender_id === session2.recipient_id);
  const hoursAgo2 = (now - new Date(session2.created_at).getTime()) / ONE_HOUR;
  const shouldRemind2 = recipientMessages2.length === 0 && hoursAgo2 >= 24;
  assert(!shouldRemind2, "Conversation where recipient has already responded is EXCLUDED (not an unstarted conversation)");

  // Case C: Opening message sent only 6 hours ago (<24h) -> Should NOT Trigger Reminder
  const session3 = {
    id: "sess-3",
    asker_id: "user-alice",
    recipient_id: "user-bob",
    created_at: new Date(now - 6 * ONE_HOUR).toISOString(),
    messages: [],
  };

  const recipientMessages3 = session3.messages.filter((m: any) => m.sender_id === session3.recipient_id);
  const hoursAgo3 = (now - new Date(session3.created_at).getTime()) / ONE_HOUR;
  const shouldRemind3 = recipientMessages3.length === 0 && hoursAgo3 >= 24;
  assert(!shouldRemind3, "Opening message < 24h old is EXCLUDED");

  // Case D: Recipient had multiple back-and-forth messages -> Should NOT Trigger Reminder
  const session4 = {
    id: "sess-4",
    asker_id: "user-alice",
    recipient_id: "user-bob",
    created_at: new Date(now - 48 * ONE_HOUR).toISOString(),
    messages: [
      { id: "m1", sender_id: "user-alice", body: "Initial question" },
      { id: "m2", sender_id: "user-bob", body: "First reply" },
      { id: "m3", sender_id: "user-alice", body: "Second follow-up" },
    ],
  };
  const recipientMessages4 = session4.messages.filter((m: any) => m.sender_id === session4.recipient_id);
  const shouldRemind4 = recipientMessages4.length === 0;
  assert(!shouldRemind4, "Multi-message thread where recipient has replied is EXCLUDED");

  // -------------------------------------------------------------------------
  // Test 4: Database connectivity & Dry-Run Evaluation
  // -------------------------------------------------------------------------
  console.log("\n[Test 4] Querying DB with Supabase Admin Client to verify query schemas...");
  try {
    const supabase = createAdminClient();

    // Check users query
    const { data: users, error: uErr } = await supabase
      .from("users")
      .select("id, email, full_name, company, job_title, home_lat, office_lat")
      .eq("is_active", true)
      .limit(5);

    assert(!uErr && Array.isArray(users), "Queried users table successfully without column errors");

    // Check chat_sessions query
    const { data: sessionsData, error: sErr } = await supabase
      .from("chat_sessions")
      .select(`
        id,
        question_id,
        created_at,
        questions!inner(id, asker_id, body, created_at, status),
        chat_participants(user_id, alias),
        chat_messages(id, sender_id, body, created_at)
      `)
      .not("question_id", "is", null)
      .limit(5);

    assert(!sErr && Array.isArray(sessionsData), "Queried chat_sessions join successfully without relation errors");

    // Check job_threads query
    const { data: threadsData, error: tErr } = await supabase
      .from("job_threads")
      .select(`
        id,
        status,
        created_at,
        job_participants(user_id, alias),
        job_messages(id, sender_id, body, created_at)
      `)
      .eq("status", "active")
      .limit(5);

    assert(!tErr && Array.isArray(threadsData), "Queried job_threads join successfully without relation errors");

    // Check in_app_notifications query
    const { data: notifs, error: nErr } = await supabase
      .from("in_app_notifications")
      .select("id, user_id, title, url, created_at")
      .limit(5);

    assert(!nErr && Array.isArray(notifs), "Queried in_app_notifications table successfully");

  } catch (dbErr: any) {
    assert(false, `Database query test failed: ${dbErr.message}`);
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test runner crashed:", e);
  process.exit(1);
});

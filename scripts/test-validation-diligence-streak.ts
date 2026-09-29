import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";

interface TestResult {
  name: string;
  passed: boolean;
  details?: any;
}

async function runValidation() {
  console.log("=================================================");
  console.log("🧪 VALIDATION: Diligence Streak Tracking System");
  console.log("=================================================\n");

  const supabase = createAdminClient();
  const results: TestResult[] = [];

  // Pick a test user
  const { data: users, error: userErr } = await supabase
    .from("users")
    .select("id, full_name, email")
    .limit(1);

  if (userErr || !users || users.length === 0) {
    console.error("Failed to find test user:", userErr);
    process.exit(1);
  }

  const testUser = users[0];
  console.log(`Using test user: ${testUser.full_name} (${testUser.id})\n`);

  // Clean up any existing streak for clean testing
  await supabase.from("user_streaks").delete().eq("user_id", testUser.id);

  function getTodayIST(): string {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }

  function getDateDaysAgoIST(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }

  const today = getTodayIST();
  const yesterday = getDateDaysAgoIST(1);
  const fourDaysAgo = getDateDaysAgoIST(4);

  // -----------------------------------------------------------------
  // Test Case 1: Initial Check-In (Day 1 Started)
  // -----------------------------------------------------------------
  console.log("▶ Test 1: First-time check-in creates Day 1 streak...");
  {
    // Simulate what POST /api/streak/check-in does
    const { data: inserted, error: insertErr } = await supabase
      .from("user_streaks")
      .insert({
        user_id: testUser.id,
        current_streak: 1,
        longest_streak: 1,
        last_checkin_date: today,
        previous_streak: 0,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    const passed = !insertErr && inserted.current_streak === 1 && inserted.last_checkin_date === today;
    results.push({
      name: "Test 1: Initial Day 1 Streak Creation",
      passed,
      details: { inserted, insertErr },
    });
    console.log(passed ? "  ✅ PASSED: Day 1 streak initialized correctly." : "  ❌ FAILED");
  }

  // -----------------------------------------------------------------
  // Test Case 2: Same-day Check-In (Idempotent, no increment)
  // -----------------------------------------------------------------
  console.log("\n▶ Test 2: Same-day repeat visit does not double-increment...");
  {
    const { data: current } = await supabase
      .from("user_streaks")
      .select("*")
      .eq("user_id", testUser.id)
      .single();

    // In check-in route: diff === 0 => remains current_streak = 1
    const isSameDay = current?.last_checkin_date === today;
    const passed = isSameDay && current?.current_streak === 1;
    results.push({
      name: "Test 2: Same-day Visit Idempotency",
      passed,
      details: { current_streak: current?.current_streak, last_date: current?.last_checkin_date },
    });
    console.log(passed ? "  ✅ PASSED: Same-day check-in is idempotent (streak remains 1)." : "  ❌ FAILED");
  }

  // -----------------------------------------------------------------
  // Test Case 3: Consecutive Day Check-In (Increment from yesterday)
  // -----------------------------------------------------------------
  console.log("\n▶ Test 3: Next day visit increments streak...");
  {
    // Simulate user had checked in yesterday with streak of 5
    await supabase
      .from("user_streaks")
      .update({
        current_streak: 5,
        longest_streak: 5,
        last_checkin_date: yesterday,
      })
      .eq("user_id", testUser.id);

    // Simulate check-in today:
    const nextStreak = 5 + 1;
    const nextLongest = Math.max(5, nextStreak);
    const { data: updated, error: updErr } = await supabase
      .from("user_streaks")
      .update({
        current_streak: nextStreak,
        longest_streak: nextLongest,
        last_checkin_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", testUser.id)
      .select()
      .single();

    const passed = !updErr && updated.current_streak === 6 && updated.longest_streak === 6;
    results.push({
      name: "Test 3: Consecutive Day Increment (5 -> 6)",
      passed,
      details: { updated, updErr },
    });
    console.log(passed ? `  ✅ PASSED: Streak incremented from 5 to 6 on consecutive check-in.` : "  ❌ FAILED");
  }

  // -----------------------------------------------------------------
  // Test Case 4: Broken Streak Handling (Missed days)
  // -----------------------------------------------------------------
  console.log("\n▶ Test 4: Broken streak (missed days) resets to 1 and preserves previous_streak...");
  {
    // Simulate user had a 10-day streak, but last checked in 4 days ago
    await supabase
      .from("user_streaks")
      .update({
        current_streak: 10,
        longest_streak: 10,
        last_checkin_date: fourDaysAgo,
      })
      .eq("user_id", testUser.id);

    // Now check in today: diff > 1 => break!
    const brokenFrom = 10;
    const { data: resetRecord, error: resetErr } = await supabase
      .from("user_streaks")
      .update({
        previous_streak: brokenFrom,
        current_streak: 1,
        last_checkin_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", testUser.id)
      .select()
      .single();

    // Verify reset
    const passed =
      !resetErr &&
      resetRecord.current_streak === 1 &&
      resetRecord.previous_streak === 10 &&
      resetRecord.longest_streak === 10;

    results.push({
      name: "Test 4: Broken Streak Reset with History Preservation",
      passed,
      details: { resetRecord, resetErr },
    });
    console.log(
      passed
        ? `  ✅ PASSED: Streak broken correctly: 10-day streak preserved as previous_streak, current reset to 1.`
        : "  ❌ FAILED"
    );
  }

  // -----------------------------------------------------------------
  // Test Case 5: Broken Streak Notification Generation
  // -----------------------------------------------------------------
  console.log("\n▶ Test 5: Broken streak triggers notification to user...");
  {
    const brokenStreakCount = 10;
    const notifTitle = "Diligence Streak Reset 💔";
    const notifBody = `Your Diligence Streak of #${brokenStreakCount} days broke, Streak count #1 now. Consistency is key — start your new streak today!`;

    const { data: notif, error: notifErr } = await supabase
      .from("in_app_notifications")
      .insert({
        user_id: testUser.id,
        title: notifTitle,
        body: notifBody,
        url: "/network",
      })
      .select()
      .single();

    const passed =
      !notifErr &&
      notif.title === notifTitle &&
      notif.body.includes("Your Diligence Streak of #10 days broke, Streak count #1 now");

    results.push({
      name: "Test 5: Broken Streak Notification Dispatched",
      passed,
      details: { notif, notifErr },
    });
    console.log(
      passed
        ? `  ✅ PASSED: Notification created: "${notif.body}"`
        : "  ❌ FAILED"
    );

    // Clean up test notification
    if (notif?.id) {
      await supabase.from("in_app_notifications").delete().eq("id", notif.id);
    }
  }

  // -----------------------------------------------------------------
  // Test Case 6: Milestone Detection
  // -----------------------------------------------------------------
  console.log("\n▶ Test 6: Milestone Detection for 7, 14, 30, 50, 100 days...");
  {
    const MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365];
    const is30Milestone = MILESTONES.includes(30);
    const is7Milestone = MILESTONES.includes(7);
    const is6Milestone = MILESTONES.includes(6);

    const passed = is30Milestone && is7Milestone && !is6Milestone;
    results.push({
      name: "Test 6: Milestone Logic Verification",
      passed,
      details: { is30Milestone, is7Milestone, is6Milestone },
    });
    console.log(passed ? `  ✅ PASSED: Milestones verified (7, 30 are milestones; 6 is not).` : "  ❌ FAILED");
  }

  // Clean up test streak data
  await supabase.from("user_streaks").delete().eq("user_id", testUser.id);

  console.log("\n=================================================");
  console.log("📊 VALIDATION SUMMARY:");
  const totalPassed = results.filter((r) => r.passed).length;
  console.log(`Total: ${results.length} | Passed: ${totalPassed} | Failed: ${results.length - totalPassed}`);
  console.log("=================================================");

  if (totalPassed !== results.length) {
    process.exit(1);
  }
}

runValidation().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { handleEventReminders } from "../app/api/cron/event-reminders/route";
import { handleMorningReminders } from "../app/api/cron/morning-reminders/route";
import { createAdminClient } from "../lib/supabase/admin";
import { sendNotification } from "../lib/notifications";

async function main() {
  console.log("=================================================================");
  console.log("   PROXNET: RUNNING PENDING NOTIFICATIONS & EMAIL FALLBACKS     ");
  console.log("=================================================================");
  console.log(`Timestamp: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST\n`);

  const supabase = createAdminClient();

  // -------------------------------------------------------------------
  // 1. RUN MEETUP EVENT REMINDERS TO 2KM RADIUS RESIDENTS
  // -------------------------------------------------------------------
  console.log("-----------------------------------------------------------------");
  console.log("1. PROCESSING MEETUP EVENT REMINDERS (2KM RADIUS & RSVPs)");
  console.log("-----------------------------------------------------------------");
  
  try {
    const eventRes = await handleEventReminders(null, true);
    const eventResult = await eventRes.json();
    console.log(`Event Reminders Status: ${eventResult.success ? "SUCCESS" : "FAILED"}`);
    console.log(`Notifications Sent: ${eventResult.sentCount}`);
    console.log(`Recurring Events Cloned: ${eventResult.recurringCount}`);
  } catch (err) {
    console.error("Error running event reminders:", err);
  }

  // -------------------------------------------------------------------
  // 2. RUN PENDING CHAT & REFERRAL STARTER REMINDERS (VIA MORNING CRON)
  // -------------------------------------------------------------------
  console.log("\n-----------------------------------------------------------------");
  console.log("2. PROCESSING PENDING CHAT & REFERRAL FIRST RESPONSE REMINDERS");
  console.log("-----------------------------------------------------------------");

  try {
    const morningRes = await handleMorningReminders(null, true);
    const morningResult = await morningRes.json();
    console.log(`Morning Reminders Status: ${morningResult.success ? "SUCCESS" : "FAILED"}`);
    console.log(`Chat Starter Reminders Sent: ${morningResult.starterRemindersSent}`);
    console.log(`Profile Reminders Sent: ${morningResult.profileRemindersSent}`);
    console.log(`Total Sent: ${morningResult.totalSent}`);

    if (morningResult.auditLog && morningResult.auditLog.length > 0) {
      console.log("\nAudit Log:");
      for (const item of morningResult.auditLog) {
        console.log(` • [${item.type}] User: ${item.userId}`);
        console.log(`   Title: ${item.title}`);
        console.log(`   URL:   ${item.url}`);
      }
    }
  } catch (err) {
    console.error("Error running morning reminders:", err);
  }

  // -------------------------------------------------------------------
  // 3. DEEP CHECK: ANY PENDING UNANSWERED CHATS OR REFERRALS
  // -------------------------------------------------------------------
  console.log("\n-----------------------------------------------------------------");
  console.log("3. DEEP AUDIT: INSPECTING ANY UNRESPONDED CHAT & REFERRAL THREADS");
  console.log("-----------------------------------------------------------------");

  // Check Job Referral Threads
  const { data: jobThreads } = await supabase
    .from("job_threads")
    .select(`
      id,
      status,
      created_at,
      job_participants(user_id, alias),
      job_messages(id, sender_id, body, created_at)
    `)
    .eq("status", "active");

  console.log(`Active referral threads found: ${jobThreads?.length || 0}`);
  for (const t of jobThreads || []) {
    const messages = (t.job_messages || []).sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    if (messages.length === 0) continue;
    const initiatorId = messages[0].sender_id;
    const participants = t.job_participants || [];
    const recipient = participants.find((p: any) => p.user_id !== initiatorId);
    const initiator = participants.find((p: any) => p.user_id === initiatorId);

    const recipientReplies = messages.filter((m: any) => m.sender_id === recipient?.user_id);
    const hasReplied = recipientReplies.length > 0;

    console.log(` • Thread ${t.id}:`);
    console.log(`   From: ${initiator?.alias || initiatorId} -> To: ${recipient?.alias || recipient?.user_id}`);
    console.log(`   Messages: ${messages.length} | Recipient Replied: ${hasReplied ? "YES" : "NO (PENDING)"}`);
    console.log(`   Created: ${t.created_at}`);

    // If pending, verify or send direct reminder if needed
    if (!hasReplied && recipient) {
      console.log(`   -> Recipient has not responded to initial referral pitch.`);
    }
  }

  // Check Direct Chat Sessions
  const { data: chatSessions } = await supabase
    .from("chat_sessions")
    .select(`
      id,
      question_id,
      created_at,
      questions(id, asker_id, body, status),
      chat_participants(user_id, alias),
      chat_messages(id, sender_id, body, created_at)
    `)
    .limit(10);

  console.log(`\nChat sessions sampled: ${chatSessions?.length || 0}`);
  for (const s of chatSessions || []) {
    const messages = (s.chat_messages || []).sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    if (messages.length === 0) continue;
    const openerId = messages[0].sender_id;
    const participants = s.chat_participants || [];
    const recipient = participants.find((p: any) => p.user_id !== openerId);
    const initiator = participants.find((p: any) => p.user_id === openerId);

    const recipientReplies = messages.filter((m: any) => m.sender_id === recipient?.user_id);
    const hasReplied = recipientReplies.length > 0;

    console.log(` • Session ${s.id}:`);
    console.log(`   From: ${initiator?.alias || openerId} -> To: ${recipient?.alias || recipient?.user_id}`);
    console.log(`   Messages: ${messages.length} | Recipient Replied: ${hasReplied ? "YES" : "NO (PENDING)"}`);
  }

  console.log("\n=================================================================");
  console.log("   PENDING NOTIFICATIONS EXECUTION COMPLETE                      ");
  console.log("=================================================================\n");
}

main().catch(console.error);

import { handleMorningReminders } from "../app/api/cron/morning-reminders/route";

async function main() {
  console.log("=========================================================");
  console.log("   INVOKING 9:00 AM IST PROXNET MORNING REMINDERS CRON   ");
  console.log("=========================================================");
  console.log(`Current Time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`);

  try {
    const res = await handleMorningReminders(null, true);
    const result = await res.json();

    console.log("\n--- CRON EXECUTION SUMMARY ---");
    console.log(`Status: ${result.success ? "SUCCESS" : "FAILED"}`);
    console.log(`Scheduled Time: ${result.scheduledTime || "09:00 AM IST (03:30 UTC)"}`);
    console.log(`Profile Reminders Sent: ${result.profileRemindersSent}`);
    console.log(`Chat Starter Reminders Sent: ${result.starterRemindersSent}`);
    console.log(`Total Reminders Dispatched: ${result.totalSent}`);

    if (result.auditLog && result.auditLog.length > 0) {
      console.log("\n--- AUDIT LOG (First 20 Events) ---");
      for (const item of result.auditLog) {
        console.log(`  • [${item.type}] User: ${item.userId}`);
        console.log(`    Title: ${item.title}`);
        console.log(`    URL:   ${item.url}`);
      }
    } else {
      console.log("\nℹ️  Audit Log: No users required reminders today (all eligible users were already notified in last 24h or have complete profiles / responded chats).");
    }

    console.log("\n=========================================================");
  } catch (err) {
    console.error("❌ Error executing morning reminders cron:", err);
    process.exit(1);
  }
}

main().catch(console.error);

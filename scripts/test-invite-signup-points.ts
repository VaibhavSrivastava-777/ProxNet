import { POINTS_CONFIG } from "../lib/network-score";

async function main() {
  console.log("=== Validating INVITE_SIGNUP Points Reduction ===");

  console.log(`POINTS_CONFIG.INVITE_SIGNUP = ${POINTS_CONFIG.INVITE_SIGNUP}`);

  if (POINTS_CONFIG.INVITE_SIGNUP !== 20) {
    console.error(`❌ Validation failed: expected 20, got ${POINTS_CONFIG.INVITE_SIGNUP}`);
    process.exit(1);
  }

  // Verify notification string template formatting
  const points = POINTS_CONFIG.INVITE_SIGNUP;
  const label = "A professional from your neighborhood just joined ProxNet";
  const notificationBody = `${label}. Your network is stronger now. (+${points} pts)`;
  console.log(`Simulated notification body: "${notificationBody}"`);

  if (!notificationBody.includes("(+20 pts)")) {
    console.error(`❌ Notification body formatting failed: ${notificationBody}`);
    process.exit(1);
  }

  console.log("✅ Validation passed: INVITE_SIGNUP is strictly configured to +20 points.");
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

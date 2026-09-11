import { readFileSync, existsSync } from "fs";
import { join } from "path";

function runTests() {
  console.log("=================================================");
  console.log("🧪 VALIDATION TEST: iOS WEB PUSH SANITIZATION & RELIABILITY");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}${detail ? ` -> ${detail}` : ""}`);
      failed++;
    }
  }

  const root = process.cwd();

  // Test 1: lib/notifications.ts sanitizes webpush payload for iOS
  const notificationsPath = join(root, "lib", "notifications.ts");
  assert(existsSync(notificationsPath), "lib/notifications.ts exists");
  const notificationsCode = readFileSync(notificationsPath, "utf-8");

  assert(notificationsCode.includes("const isIos = tokenRecord.platform === \"ios\";"), "Identifies iOS platform tokens");
  assert(notificationsCode.includes("if (!isIos) {"), "Only attaches vibrate & reply actions to non-iOS tokens");
  assert(notificationsCode.includes("Urgency: \"high\""), "Sets WebPush Urgency high header for APNs");
  assert(notificationsCode.includes("apns-priority\": \"10\""), "Sets APNs priority 10");
  assert(notificationsCode.includes("aps: {"), "Configures APS dictionary");
  assert(notificationsCode.includes("alert: {"), "Provides visual alert payload for Apple APNs");

  // Test 2: public/firebase-messaging-sw.js handles iOS WebKit safely
  const swPath = join(root, "public", "firebase-messaging-sw.js");
  assert(existsSync(swPath), "public/firebase-messaging-sw.js exists");
  const swCode = readFileSync(swPath, "utf-8");
  assert(swCode.includes("const isIOS = /iPad|iPhone|iPod/.test"), "Service Worker detects iOS environment");
  assert(swCode.includes("if (!isIOS) {"), "Does not pass vibrate/renotify on iOS");
  assert(swCode.includes("try {") && swCode.includes("catch (err)"), "Wraps showNotification in try/catch fallback");

  // Test 3: app/firebase-messaging-sw.js/route.ts handles iOS WebKit safely
  const swRoutePath = join(root, "app", "firebase-messaging-sw.js", "route.ts");
  assert(existsSync(swRoutePath), "app/firebase-messaging-sw.js/route.ts exists");
  const swRouteCode = readFileSync(swRoutePath, "utf-8");
  assert(swRouteCode.includes("const isIOS = /iPad|iPhone|iPod/.test"), "SW route detects iOS environment");
  assert(swRouteCode.includes("if (!isIOS) {"), "SW route strips actions & vibrate for iOS");

  // Test 4: ProfileForm.tsx displays "✓ Enabled on this device" when permission is granted
  const profileFormPath = join(root, "components", "profile", "ProfileForm.tsx");
  assert(existsSync(profileFormPath), "components/profile/ProfileForm.tsx exists");
  const profileFormCode = readFileSync(profileFormPath, "utf-8");
  assert(profileFormCode.includes("✓ Enabled on this device"), "ProfileForm displays 'Enabled on this device' badge");
  assert(profileFormCode.includes("platform: isIos ? \"ios\" : \"web\""), "ProfileForm registers platform as 'ios' for iPhone users");
  assert(profileFormCode.includes("Re-sync"), "Offers clean Re-sync button when already subscribed");

  // Test 5: diagnose-push route includes webpush and apns
  const diagnoseRoutePath = join(root, "app", "api", "admin", "diagnose-push", "route.ts");
  assert(existsSync(diagnoseRoutePath), "diagnose-push route exists");
  const diagnoseCode = readFileSync(diagnoseRoutePath, "utf-8");
  assert(diagnoseCode.includes("webpush: {"), "diagnose-push route provides webpush block");
  assert(diagnoseCode.includes("apns: {"), "diagnose-push route provides apns block");

  console.log(`\n=================================================`);
  console.log(`🏁 VALIDATION RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`=================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

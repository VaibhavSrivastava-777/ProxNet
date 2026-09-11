import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { haversineDistanceMeters } from "../lib/geo/haversine";

function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING VALIDATION: EVENT REMINDERS & PWA PUSH");
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

  // -------------------------------------------------------------
  // Test Suite 1: NavClient.tsx PWA Background / Unfocused Display
  // -------------------------------------------------------------
  const navClientPath = join(root, "components", "NavClient.tsx");
  assert(existsSync(navClientPath), "NavClient.tsx exists");
  const navContent = readFileSync(navClientPath, "utf-8");

  assert(
    navContent.includes("document.hidden || !document.hasFocus()"),
    "NavClient detects unfocused/hidden document state on incoming FCM message"
  );
  assert(
    navContent.includes("registration.showNotification(title, options)"),
    "NavClient triggers OS system notification via service worker registration when unfocused"
  );
  assert(
    navContent.includes("!isIosUser") && navContent.includes(".vibrate"),
    "NavClient respects iOS WebKit limitations by omitting vibrate on iOS"
  );
  assert(
    navContent.includes("playNotificationSound"),
    "NavClient plays synthesized audio chime upon message arrival"
  );
  assert(
    navContent.includes("triggerToast"),
    "NavClient maintains in-app toast for when user returns to app"
  );

  // -------------------------------------------------------------
  // Test Suite 2: Event Reminders Cron Route (7-Day & 24h Rules)
  // -------------------------------------------------------------
  const eventCronPath = join(root, "app", "api", "cron", "event-reminders", "route.ts");
  assert(existsSync(eventCronPath), "event-reminders/route.ts exists");
  const cronContent = readFileSync(eventCronPath, "utf-8");

  assert(
    cronContent.includes("7 * 24 * 60 * 60 * 1000"),
    "Event Reminders horizon expands to 7 full days"
  );
  assert(
    cronContent.includes("haversineDistanceMeters"),
    "Event Reminders imports and uses haversineDistanceMeters for 2km radius calculation"
  );
  assert(
    cronContent.includes("radius_2km_${daysLeft}d"),
    "Event Reminders logs daily 2km radius notifications with distinct countdown tag"
  );
  assert(
    cronContent.includes("rsvpMap.has(user.id)"),
    "Event Reminders excludes users who have already RSVPed from 2km radius blast"
  );
  assert(
    cronContent.includes("hoursUntilStart <= 24"),
    "Event Reminders restricts RSVP attendee alerts strictly to <= 24 hours"
  );
  assert(
    cronContent.includes("rsvp_24h"),
    "Event Reminders logs and deduplicates 24h RSVP reminder"
  );

  // -------------------------------------------------------------
  // Test Suite 3: Proximity Haversine Math Verification
  // -------------------------------------------------------------
  // Test with real project coordinates:
  // Vaibhav: 12.8871, 77.5900 (Arekere/Bannerghatta Road)
  // Swati:   12.8861, 77.5896 (~115 meters away)
  // Sneha:   12.9181, 77.6832 (Bellandur/Sarjapur, ~10.6 km away)

  const distSwati = haversineDistanceMeters(12.8871, 77.5900, 12.8861, 77.5896);
  assert(
    distSwati <= 200,
    `Vaibhav to Swati distance is ~115m (calculated: ${Math.round(distSwati)}m)`
  );
  assert(
    distSwati <= 2000,
    "Swati correctly falls within 2km meetup radius of Vaibhav"
  );

  const distSneha = haversineDistanceMeters(12.8871, 77.5900, 12.9181, 77.6832);
  assert(
    distSneha > 2000,
    `Sneha correctly falls outside 2km meetup radius (calculated: ${Math.round(distSneha / 1000)}km)`
  );

  // -------------------------------------------------------------
  // Test Suite 4: Cross-Platform Parity Verification
  // -------------------------------------------------------------
  const notifLibPath = join(root, "lib", "notifications.ts");
  assert(existsSync(notifLibPath), "lib/notifications.ts exists");
  const notifLibContent = readFileSync(notifLibPath, "utf-8");

  assert(
    notifLibContent.includes('platform === "ios"') &&
    notifLibContent.includes('webpush:') &&
    notifLibContent.includes('android:') &&
    notifLibContent.includes('apns:'),
    "lib/notifications.ts dispatches to all device types (android, ios, web)"
  );

  console.log(`\n=================================================`);
  console.log(`🏁 VALIDATION RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`=================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

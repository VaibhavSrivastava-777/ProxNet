/**
 * Validation Test: Mobile Web Browser Detection & Smart App Banner Logic
 *
 * Test coverage:
 * 1. iOS Safari web browser -> should detect "ios" and trigger banner
 * 2. Android Chrome web browser -> should detect "android" and trigger banner
 * 3. Standalone mode (iOS PWA or Android PWA) -> should suppress banner
 * 4. Native Android App (window.AndroidBridge) -> should suppress banner
 * 5. Desktop Windows / Mac browsers -> should suppress banner
 * 6. LocalStorage dismissal within 7 days -> should suppress banner
 * 7. LocalStorage dismissal after 7+ days -> should allow banner
 * 8. Android Play Store URL validity and package verification
 */

interface DetectionMockEnv {
  standalone?: boolean;
  matchMediaStandalone?: boolean;
  hasAndroidBridge?: boolean;
  dismissedAt?: string | null;
  userAgent: string;
  maxTouchPoints?: number;
  platform?: string;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const PLAY_STORE_PACKAGE = "in.proxnet.app";

function runBannerDetection(env: DetectionMockEnv) {
  // 1. Check standalone PWA mode
  const isStandalone =
    env.standalone === true || env.matchMediaStandalone === true;
  if (isStandalone) {
    return { show: false, reason: "Already running in standalone PWA mode" };
  }

  // 2. Check native Android app bridge
  if (env.hasAndroidBridge) {
    return { show: false, reason: "Inside native Android app" };
  }

  // 3. Check 7-day dismissal suppression
  if (env.dismissedAt) {
    const timeDiff = Date.now() - parseInt(env.dismissedAt, 10);
    if (timeDiff < SEVEN_DAYS_MS) {
      return { show: false, reason: "Dismissed by user within last 7 days" };
    }
  }

  // 4. Platform detection
  const ua = env.userAgent.toLowerCase();
  const isIpad = ua.includes("ipad");
  const isIphone = ua.includes("iphone") && !ua.includes("like iphone");
  const isMacTouch =
    ua.includes("macintosh") &&
    (env.maxTouchPoints || 0) > 1;

  const isIos = isIphone || isIpad || isMacTouch;
  const isAndroid = ua.includes("android");

  if (isIos) {
    return { show: true, platform: "ios", action: "share_to_homescreen_drawer" };
  }
  if (isAndroid) {
    return {
      show: true,
      platform: "android",
      action: "google_play_store",
      playStoreUrl: `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE}`,
      marketIntent: `market://details?id=${PLAY_STORE_PACKAGE}`,
    };
  }

  return { show: false, reason: "Desktop or unsupported platform" };
}

function runTests() {
  console.log("=== RUNNING SMART APP BANNER VALIDATION TESTS ===\n");
  let passed = 0;
  let total = 0;

  function assert(testName: string, condition: boolean, details?: any) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, details || "");
      process.exitCode = 1;
    }
  }

  // Test 1: iPhone Safari web browser (User 1 scenario)
  const iosResult = runBannerDetection({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    standalone: false,
    hasAndroidBridge: false,
  });
  assert(
    "iPhone on Safari shows iOS banner with Home Screen prompt",
    iosResult.show === true &&
      iosResult.platform === "ios" &&
      iosResult.action === "share_to_homescreen_drawer",
    iosResult
  );

  // Test 2: iPad Safari web browser
  const ipadResult = runBannerDetection({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
    maxTouchPoints: 5,
    standalone: false,
  });
  assert(
    "iPad Safari shows iOS banner with Home Screen prompt",
    ipadResult.show === true && ipadResult.platform === "ios",
    ipadResult
  );

  // Test 3: Android Chrome web browser
  const androidResult = runBannerDetection({
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.105 Mobile Safari/537.36",
    standalone: false,
    hasAndroidBridge: false,
  });
  assert(
    "Android Chrome shows Android banner with Google Play Store link",
    androidResult.show === true &&
      androidResult.platform === "android" &&
      androidResult.action === "google_play_store" &&
      androidResult.playStoreUrl?.includes("in.proxnet.app") &&
      androidResult.marketIntent === "market://details?id=in.proxnet.app",
    androidResult
  );

  // Test 4: iPhone with ProxNet added to Home Screen (Standalone PWA)
  const iosPwaResult = runBannerDetection({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    standalone: true,
  });
  assert(
    "iPhone Standalone PWA suppresses banner",
    iosPwaResult.show === false &&
      iosPwaResult.reason === "Already running in standalone PWA mode",
    iosPwaResult
  );

  // Test 5: Android Chrome installed as PWA (matchMedia standalone)
  const androidPwaResult = runBannerDetection({
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.105 Mobile Safari/537.36",
    matchMediaStandalone: true,
  });
  assert(
    "Android Standalone PWA suppresses banner",
    androidPwaResult.show === false &&
      androidPwaResult.reason === "Already running in standalone PWA mode",
    androidPwaResult
  );

  // Test 6: Inside native Android app WebView (window.AndroidBridge present)
  const nativeAppResult = runBannerDetection({
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.105 Mobile Safari/537.36",
    hasAndroidBridge: true,
  });
  assert(
    "Inside native Android app suppresses banner",
    nativeAppResult.show === false &&
      nativeAppResult.reason === "Inside native Android app",
    nativeAppResult
  );

  // Test 7: Desktop Windows browser (Chrome)
  const desktopResult = runBannerDetection({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    maxTouchPoints: 0,
  });
  assert(
    "Desktop Windows PC suppresses banner",
    desktopResult.show === false &&
      desktopResult.reason === "Desktop or unsupported platform",
    desktopResult
  );

  // Test 8: Dismissal within 7 days (e.g. 2 days ago)
  const twoDaysAgo = (Date.now() - 2 * 24 * 60 * 60 * 1000).toString();
  const dismissedRecentResult = runBannerDetection({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    dismissedAt: twoDaysAgo,
  });
  assert(
    "Recent dismissal (<7 days) suppresses banner",
    dismissedRecentResult.show === false &&
      dismissedRecentResult.reason === "Dismissed by user within last 7 days",
    dismissedRecentResult
  );

  // Test 9: Dismissal after 7 days (e.g. 8 days ago) -> should re-prompt
  const eightDaysAgo = (Date.now() - 8 * 24 * 60 * 60 * 1000).toString();
  const dismissedOldResult = runBannerDetection({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    dismissedAt: eightDaysAgo,
  });
  assert(
    "Old dismissal (>7 days) re-shows banner",
    dismissedOldResult.show === true && dismissedOldResult.platform === "ios",
    dismissedOldResult
  );

  console.log(`\n========================================`);
  console.log(`RESULT: ${passed}/${total} TESTS PASSED`);
  console.log(`========================================\n`);
}

runTests();

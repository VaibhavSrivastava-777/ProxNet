import assert from "assert";
import { formatLinkedInUrl, normalizeLinkedInUrl } from "../lib/linkedin/normalize-url";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🧪 RUNNING LINKEDIN URL FORMATTING & UI VALIDATION TESTS...\n");

  // ==========================================
  // TEST 1: formatLinkedInUrl Normalization
  // ==========================================
  console.log("[Test 1] URL & Handle formatting tests...");

  // 1. Mobile app share URL with tracking params
  const mobileShareUrl = "https://www.linkedin.com/in/aditi-sharma-1234/?utm_source=share&utm_medium=member_android&rcm=ACoAAA";
  assert.strictEqual(
    formatLinkedInUrl(mobileShareUrl),
    "https://www.linkedin.com/in/aditi-sharma-1234",
    "Should strip tracking params and trailing slash"
  );
  console.log("  ✓ Mobile app share URL with UTM parameters formatted cleanly");

  // 2. Naked domain without https
  assert.strictEqual(
    formatLinkedInUrl("linkedin.com/in/john-doe"),
    "https://www.linkedin.com/in/john-doe",
    "Should prepend https://www."
  );
  console.log("  ✓ Naked domain 'linkedin.com/in/john-doe' formatted to full https URL");

  // 3. Domain with www but no protocol
  assert.strictEqual(
    formatLinkedInUrl("www.linkedin.com/in/sarah-smith/"),
    "https://www.linkedin.com/in/sarah-smith",
    "Should format www.linkedin.com"
  );
  console.log("  ✓ 'www.linkedin.com/in/sarah-smith/' formatted cleanly");

  // 4. Standalone handle / username
  assert.strictEqual(
    formatLinkedInUrl("rahul-verma-99"),
    "https://www.linkedin.com/in/rahul-verma-99",
    "Should format handle to full linkedin profile URL"
  );
  console.log("  ✓ Plain handle 'rahul-verma-99' formatted to full URL");

  // 5. Handle starting with @
  assert.strictEqual(
    formatLinkedInUrl("@priyasharma"),
    "https://www.linkedin.com/in/priyasharma",
    "Should strip @ and format handle"
  );
  console.log("  ✓ Handle with @ symbol '@priyasharma' formatted cleanly");

  // 6. Empty / whitespace
  assert.strictEqual(formatLinkedInUrl(""), "", "Empty string should return empty");
  assert.strictEqual(formatLinkedInUrl(null), "", "Null should return empty");
  console.log("  ✓ Empty and null inputs handled safely");

  // ==========================================
  // TEST 2: Absence of hardcoded person name in UI
  // ==========================================
  console.log("\n[Test 2] Verifying removal of hardcoded 'VaibhavSrivastava777' placeholder...");

  const profileFormPath = path.resolve(__dirname, "../components/profile/ProfileForm.tsx");
  const profileFormContent = fs.readFileSync(profileFormPath, "utf-8");
  assert(
    !profileFormContent.includes("VaibhavSrivastava777"),
    "ProfileForm.tsx must not contain hardcoded placeholder 'VaibhavSrivastava777'"
  );
  assert(
    profileFormContent.includes("https://www.linkedin.com/in/your-profile"),
    "ProfileForm.tsx must use clean standard placeholder 'https://www.linkedin.com/in/your-profile'"
  );
  console.log("  ✓ ProfileForm.tsx: 'VaibhavSrivastava777' completely replaced with standard URL placeholder");

  const userFormPath = path.resolve(__dirname, "../components/admin/UserForm.tsx");
  const userFormContent = fs.readFileSync(userFormPath, "utf-8");
  assert(
    !userFormContent.includes("VaibhavSrivastava777"),
    "UserForm.tsx must not contain hardcoded placeholder 'VaibhavSrivastava777'"
  );
  assert(
    userFormContent.includes("https://www.linkedin.com/in/your-profile"),
    "UserForm.tsx must use clean standard placeholder 'https://www.linkedin.com/in/your-profile'"
  );
  console.log("  ✓ UserForm.tsx: 'VaibhavSrivastava777' completely replaced with standard URL placeholder");

  console.log("\n🎉 ALL LINKEDIN URL UI/UX VALIDATION TESTS PASSED! 🚀\n");
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});

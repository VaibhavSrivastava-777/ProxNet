import { readFileSync } from "fs";
import { join } from "path";

function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING VALIDATION: CONTACT US INSTAGRAM TARGET");
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
  const targetUrl = "https://www.instagram.com/proxnet.connect/";

  // 1. Validate app/qa/QAContent.tsx
  const qaPath = join(root, "app", "qa", "QAContent.tsx");
  const qaContent = readFileSync(qaPath, "utf-8");

  assert(
    qaContent.includes(`href="${targetUrl}"`),
    "QAContent.tsx links Contact Us to Instagram"
  );
  assert(
    !qaContent.includes("wa.me/918197678983"),
    "QAContent.tsx removes obsolete WhatsApp link for Contact Us"
  );
  assert(
    (qaContent.match(new RegExp(targetUrl, "g")) || []).length === 2,
    "QAContent.tsx updates both forum/feed and network tab footers"
  );

  // 2. Validate app/page.tsx
  const pagePath = join(root, "app", "page.tsx");
  const pageContent = readFileSync(pagePath, "utf-8");

  assert(
    pageContent.includes(`href="${targetUrl}"`),
    "app/page.tsx links Contact Us to Instagram"
  );
  assert(
    !pageContent.includes("wa.me/918197678983"),
    "app/page.tsx removes obsolete WhatsApp link for Contact Us"
  );
  assert(
    pageContent.includes('target="_blank"') && pageContent.includes('rel="noopener noreferrer"'),
    "app/page.tsx opens Instagram link safely in new tab"
  );

  console.log(`\n=================================================`);
  console.log(`🏁 VALIDATION RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`=================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

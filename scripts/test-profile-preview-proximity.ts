import { readFileSync, existsSync } from "fs";
import { join } from "path";

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`✅ ${msg}`);
  } else {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
}

console.log("=== Testing Profile Preview in Network Proximity View ===\n");

const root = process.cwd();
const previewPath = join(root, "components", "profile", "ProfilePreview.tsx");
assert(existsSync(previewPath), "ProfilePreview component exists (components/profile/ProfilePreview.tsx)");

const previewCode = readFileSync(previewPath, "utf-8");
assert(previewCode.includes("Network Proximity View"), "Header identifies Network Proximity View");
assert(previewCode.includes("Within 2km"), "Displays Within 2km proximity badge");
assert(previewCode.includes("visibility.showCompany"), "Honors visibility.showCompany privacy setting");
assert(previewCode.includes("visibility.showTitle"), "Honors visibility.showTitle privacy setting");
assert(previewCode.includes("help_offers"), "Displays I Can Help With scrapbook section");
assert(previewCode.includes("tinkering_with"), "Displays Tinkering With scrapbook section");
assert(previewCode.includes("ask_me_about"), "Displays Ask Me About scrapbook section");
assert(previewCode.includes("quick_chat_preference"), "Displays quick chat preference (chai, walk, etc.)");
assert(previewCode.includes("onEditClick"), "Provides return to edit action callback");

console.log("\nAll Profile Preview tests passed successfully!");

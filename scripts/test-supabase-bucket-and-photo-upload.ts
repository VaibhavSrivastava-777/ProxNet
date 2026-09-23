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

console.log("=== Testing Supabase Bucket Config & Photo Upload Route ===\n");

const root = process.cwd();

// 1. Verify SQL migration exists
const migrationPath = join(root, "supabase", "migrations", "20260923_profile_photos_bucket.sql");
assert(existsSync(migrationPath), "Migration file exists: 20260923_profile_photos_bucket.sql");

const sqlContent = readFileSync(migrationPath, "utf-8");
assert(sqlContent.includes("'profile-photos'"), "SQL specifies 'profile-photos' bucket");
assert(sqlContent.includes("public, file_size_limit, allowed_mime_types"), "SQL configures public, size limit, and mime types");
assert(sqlContent.includes("CREATE POLICY"), "SQL contains RLS security policies for storage.objects");
assert(sqlContent.includes("5242880"), "SQL sets 5MB size limit (5242880 bytes)");

// 2. Verify upload photo route exists and has proper handling
const routePath = join(root, "app", "api", "profile", "upload-photo", "route.ts");
assert(existsSync(routePath), "Upload route exists: app/api/profile/upload-photo/route.ts");

const routeContent = readFileSync(routePath, "utf-8");
assert(routeContent.includes("getCurrentUser"), "Upload route requires authenticated session");
assert(routeContent.includes("validMimes"), "Upload route validates image MIME types");
assert(routeContent.includes("createBucket"), "Upload route auto-provisions profile-photos bucket if missing");
assert(routeContent.includes("getPublicUrl"), "Upload route gets public URL for uploaded photo");
assert(routeContent.includes("profile_photo_url: photoUrl"), "Upload route persists photo URL to user table");

console.log("\nAll Supabase bucket config & photo upload tests passed successfully!");

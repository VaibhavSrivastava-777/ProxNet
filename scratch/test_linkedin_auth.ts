import { upsertOAuthUser } from "../lib/users";
import { createAdminClient } from "../lib/supabase/admin";

async function test() {
  console.log("Running LinkedIn Auth integration tests...");

  // Generate a random unique sub
  const testSub = "test-sub-" + Math.random().toString(36).substring(2, 10);
  const testEmail = `test-${testSub}@example.com`;
  const testName = "Test LinkedIn User";
  const testPicture = "https://example.com/photo.jpg";
  const testProfileUrl = "https://www.linkedin.com/in/test-user-profile-url-xyz";
  const testHeadline = "Senior Staff AI Engineer at DeepMind";

  console.log("1. Testing upsertOAuthUser insert flow with headline...");
  const user1 = await upsertOAuthUser({
    sub: testSub,
    email: testEmail,
    name: testName,
    picture: testPicture,
    linkedinProfileUrl: testProfileUrl,
    headline: testHeadline,
  });

  console.log("Created user:", {
    id: user1.id,
    full_name: user1.full_name,
    email: user1.email,
    profile_photo_url: user1.profile_photo_url,
    linkedin_profile_url: user1.linkedin_profile_url,
    job_title: user1.job_title,
  });

  if (user1.job_title !== testHeadline) {
    throw new Error(`Headline not persisted to job_title. Expected: "${testHeadline}", got: "${user1.job_title}"`);
  }
  if (user1.linkedin_profile_url !== "https://www.linkedin.com/in/test-user-profile-url-xyz") {
    throw new Error(`Profile URL not normalized/persisted correctly. Got: "${user1.linkedin_profile_url}"`);
  }
  console.log("✓ Insert flow verified successfully!");

  console.log("2. Testing upsertOAuthUser update flow with modified headline...");
  const newHeadline = "Lead Principal Architect";
  const user2 = await upsertOAuthUser({
    sub: testSub,
    email: testEmail,
    name: testName,
    picture: testPicture,
    linkedinProfileUrl: testProfileUrl,
    headline: newHeadline,
  });

  console.log("Updated user:", {
    id: user2.id,
    job_title: user2.job_title,
  });

  if (user2.job_title !== newHeadline) {
    throw new Error(`Headline not updated in job_title. Expected: "${newHeadline}", got: "${user2.job_title}"`);
  }
  console.log("✓ Update flow verified successfully!");

  // Clean up
  const supabase = createAdminClient();
  const { error } = await supabase.from("users").delete().eq("id", user1.id);
  if (error) {
    console.error("Failed to clean up test user:", error);
  } else {
    console.log("✓ Test user cleaned up successfully!");
  }

  console.log("All tests passed successfully!");
}

test().catch(console.error);

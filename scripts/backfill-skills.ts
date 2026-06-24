import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing required environment variables NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  console.log("Fetching job posts...");
  const { data: posts, error } = await supabase
    .from("job_posts")
    .select("id, skills");

  if (error) {
    console.error("Failed to fetch job posts:", error.message);
    process.exit(1);
  }

  console.log(`Found ${posts.length} job posts. Extracting top 5 skills...`);

  let updatedCount = 0;

  for (const post of posts) {
    if (!post.skills) continue;

    // Split by comma, semi-colon, slash, or pipeline
    const skillList = post.skills
      .split(/[,;|/]+/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    const uniqueSkills: string[] = [];
    const seen = new Set<string>();
    for (const s of skillList) {
      const lower = s.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        uniqueSkills.push(s);
      }
    }

    const top5Skills = uniqueSkills.slice(0, 5).join(", ");

    if (top5Skills !== post.skills) {
      console.log(`Updating post ${post.id}: "${post.skills}" -> "${top5Skills}"`);
      const { error: updateError } = await supabase
        .from("job_posts")
        .update({ skills: top5Skills })
        .eq("id", post.id);

      if (updateError) {
        console.error(`Failed to update post ${post.id}:`, updateError.message);
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`Finished. Updated ${updatedCount} posts.`);
}

main();

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== "proxnet_temp_seed_secret_998877") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const logs: string[] = [];

  try {
    logs.push("Fetching all job posts from job_posts table...");
    const { data: posts, error } = await supabase
      .from("job_posts")
      .select("id, role, skills");

    if (error) {
      throw new Error(`Failed to fetch job posts: ${error.message}`);
    }

    logs.push(`Found ${posts.length} job posts. Processing...`);
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
        logs.push(`Updating post ${post.id} (${post.role}): "${post.skills}" -> "${top5Skills}"`);
        const { error: updateError } = await supabase
          .from("job_posts")
          .update({ skills: top5Skills })
          .eq("id", post.id);

        if (updateError) {
          logs.push(`❌ Failed to update post ${post.id}: ${updateError.message}`);
        } else {
          updatedCount++;
        }
      }
    }

    logs.push(`Finished. Updated ${updatedCount} posts.`);

    return NextResponse.json({
      success: true,
      time: new Date().toISOString(),
      logs
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      logs
    }, { status: 500 });
  }
}

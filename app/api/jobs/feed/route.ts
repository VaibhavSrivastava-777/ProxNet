import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  // 1. Get user's active post
  const { data: activePosts, error: activeError } = await supabase
    .from("job_posts")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  if (activeError) return NextResponse.json({ error: activeError.message }, { status: 500 });
  
  const myPost = activePosts && activePosts.length > 0 ? activePosts[0] : null;

  // 2. Fetch active candidates
  let query = supabase
    .from("job_posts")
    .select(`
      *,
      user:users (
        id,
        company,
        job_title
      )
    `)
    .eq("status", "active");

  if (myPost) {
    const targetType = myPost.type === "giver" ? "seeker" : "giver";
    query = query.eq("type", targetType);
  }

  const { data: candidates, error: candError } = await query;

  if (candError) return NextResponse.json({ error: candError.message }, { status: 500 });

  // 3. Calculate Scores
  const scoredCandidates = (candidates || []).map((cand: any) => {
    let score = 0;
    
    if (myPost) {
      const myRoleWords = (myPost.role || "").toLowerCase().split(/\W+/);
      const candRoleWords = (cand.role || "").toLowerCase().split(/\W+/);

      // Intersection of role words
      const roleOverlap = myRoleWords.filter((w: string) => candRoleWords.includes(w)).length;
      if (roleOverlap > 0) score += 50;

      // Intersection of skills words
      const mySkillsWords = (myPost.skills || "").toLowerCase().split(/\W+/);
      const candSkillsWords = (cand.skills || "").toLowerCase().split(/\W+/);
      const skillsOverlap = mySkillsWords.filter((w: string) => candSkillsWords.includes(w)).length;
      if (skillsOverlap > 0) score += (skillsOverlap * 10);
      
      score = Math.min(100, score);
    }
    
    // Add a base score so all posts show up
    score += 10;

    return {
      ...cand,
      score
    };
  });

  const filtered = scoredCandidates
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({ 
    posts: filtered, 
    myPost: myPost,
    requiresPost: false,
    currentUserId: user.id
  });
}

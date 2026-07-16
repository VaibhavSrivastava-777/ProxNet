import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { awardPoints } from "@/lib/award-points";

function extractTop5Skills(skills: string): string {
  if (!skills) return "";
  const skillList = skills
    .split(/[,;|/]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  const uniqueSkills: string[] = [];
  const seen = new Set<string>();
  for (const s of skillList) {
    const lower = s.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      uniqueSkills.push(s);
    }
  }
  return uniqueSkills.slice(0, 5).join(", ");
}


export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { type, role, company, experience_years, skills, is_on_behalf, contact_number } = body;

  if (!type || !role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const processedSkills = extractTop5Skills(skills);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("job_posts")
    .insert({
      user_id: user.id,
      type,
      role,
      company: company || null,
      experience_years: parseInt(experience_years) || 0,
      skills: processedSkills || null,
      status: "active",
      is_on_behalf: is_on_behalf || false,
      contact_number: contact_number || null
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Award points to the inviter if this is the invitee's first job post
  if (user.invited_by) {
    const { count } = await supabase
      .from("job_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .neq("id", data.id); // exclude current job post
    
    if (count === 0) {
      await awardPoints(user.invited_by, "INVITEE_FIRST_REFERRAL", data.id).catch((e) =>
        console.error("Failed to award points for invitee first referral:", e)
      );
    }
  }

  // --- ProxNet AI Matchmaking (Embedding-based) ---
  try {
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) throw new Error("OpenAI key not configured");

    // 1. Generate embedding for this post
    const postText = `Role: ${role}\nSkills: ${processedSkills || "None"}\nExperience: ${experience_years || 0} years\nType: ${type === "giver" ? "Offering referral" : "Looking for role"}${company ? `\nCompany: ${company}` : ""}`;

    const embRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input: postText,
        model: "text-embedding-3-small"
      })
    });

    if (!embRes.ok) throw new Error("Failed to generate embedding");
    const embData = await embRes.json();
    const postEmbedding = embData.data[0].embedding;

    // 2. Find opposite-type posts with embedding similarity
    const oppositeType = type === "giver" ? "seeker" : "giver";
    const { data: candidates } = await supabase
      .from("job_posts")
      .select("id, user_id, role, skills, experience_years, embedding")
      .eq("status", "active")
      .eq("type", oppositeType)
      .neq("user_id", user.id);

    if (candidates && candidates.length > 0) {
      // Calculate cosine similarity
      function cosineSimilarity(a: number[], b: number[]) {
        let dot = 0, magA = 0, magB = 0;
        for (let i = 0; i < a.length; i++) {
          dot += a[i] * b[i];
          magA += a[i] * a[i];
          magB += b[i] * b[i];
        }
        return dot / (Math.sqrt(magA) * Math.sqrt(magB));
      }

      // Generate embeddings for candidates that don't have one
      const candidatesWithEmbeddings: Array<{
        id: string;
        user_id: string;
        role: string;
        skills: string;
        experience_years: number;
        similarity: number;
      }> = [];

      for (const cand of candidates) {
        let candEmbedding = cand.embedding;

        if (!candEmbedding) {
          // Generate on-the-fly
          const candText = `Role: ${cand.role}\nSkills: ${cand.skills || "None"}\nExperience: ${cand.experience_years || 0} years\nType: ${oppositeType === "giver" ? "Offering referral" : "Looking for role"}`;
          try {
            const candEmbRes = await fetch("https://api.openai.com/v1/embeddings", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${OPENAI_KEY}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                input: candText,
                model: "text-embedding-3-small"
              })
            });
            if (candEmbRes.ok) {
              const candEmbData = await candEmbRes.json();
              candEmbedding = candEmbData.data[0].embedding;
              // Save embedding for future use
              await supabase.from("job_posts").update({ embedding: candEmbedding }).eq("id", cand.id);
            }
          } catch (e) {
            // Skip this candidate
            continue;
          }
        }

        if (candEmbedding) {
          const sim = cosineSimilarity(postEmbedding, candEmbedding);
          candidatesWithEmbeddings.push({
            id: cand.id,
            user_id: cand.user_id,
            role: cand.role,
            skills: cand.skills,
            experience_years: cand.experience_years,
            similarity: sim
          });
        }
      }

      // Sort by similarity, take top 3
      candidatesWithEmbeddings.sort((a, b) => b.similarity - a.similarity);
      const top3 = candidatesWithEmbeddings.slice(0, 3).filter(c => c.similarity > 0.3);

      if (top3.length > 0) {
        // 3. Get or create AI user
        let { data: aiUser } = await supabase.from("users").select("id").eq("email", "ai@proxnet.com").maybeSingle();
        if (!aiUser) {
          const { data: newAi } = await supabase.from("users").insert({
            email: "ai@proxnet.com",
            full_name: "ProxNet AI",
            name: "ProxNet AI",
            job_title: "AI Agent",
            company: "ProxNet",
            is_admin: true,
            is_onboarded: true
          }).select("id").single();
          aiUser = newAi;
        }

        if (aiUser) {
          // 4. Send DMs to top 3 matches
          const posterName = user.full_name || "A professional";
          const action = type === "giver" ? "referring" : "looking";

          for (const match of top3) {
            const matchPct = Math.round(match.similarity * 100);
            const msgText = type === "giver"
              ? `Hi! ${posterName} is referring for a ${role}${company ? ` at ${company}` : ""}. Your skills (${match.skills || "N/A"}) are a ${matchPct}% match! Would you like to connect?`
              : `Hi! ${posterName} is looking for a ${role} role (${skills || "various skills"}, ${experience_years || 0}+ yrs). You are offering a ${match.role} referral which is a ${matchPct}% match! Would you like to connect?`;

            // Create thread
            const { data: thread } = await supabase.from("job_threads").insert({
              post_id: data.id,
              responder_post_id: match.id,
              status: "active"
            }).select("id").single();

            if (thread) {
              await supabase.from("job_participants").insert([
                { thread_id: thread.id, user_id: aiUser.id, alias: "ProxNet AI" },
                { thread_id: thread.id, user_id: match.user_id, alias: match.role || "Professional" }
              ]);

              await supabase.from("job_messages").insert({
                thread_id: thread.id,
                sender_id: aiUser.id,
                body: msgText
              });
            }
          }
        }
      }
    }

    // Save embedding on the post for future matching
    await supabase.from("job_posts").update({ embedding: postEmbedding }).eq("id", data.id);

  } catch (e) {
    console.error("AI Matchmaking failed:", e);
    // Non-blocking: the post was still created successfully
  }
  // ---

  return NextResponse.json({ post: data });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, type, role, company, experience_years, skills, is_on_behalf, contact_number } = body;

  if (!id || !type || !role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const processedSkills = extractTop5Skills(skills);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("job_posts")
    .update({
      type,
      role,
      company: company || null,
      experience_years: parseInt(experience_years) || 0,
      skills: processedSkills || null,
      is_on_behalf: is_on_behalf || false,
      contact_number: contact_number || null
    })
    .eq("id", id)
    .eq("user_id", user.id) // Ensure user owns the post
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing post ID" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("job_posts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // Ensure user owns the post

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

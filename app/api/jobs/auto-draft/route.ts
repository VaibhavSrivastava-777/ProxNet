import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Anthropic API key is not configured." },
      { status: 500 }
    );
  }

  try {
    const { targetPostId } = await request.json();

    if (!targetPostId) {
      return NextResponse.json(
        { error: "Please provide a target post ID." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Fetch the target post
    const { data: targetPost, error: targetError } = await supabase
      .from("job_posts")
      .select("*")
      .eq("id", targetPostId)
      .single();

    if (targetError || !targetPost) {
      return NextResponse.json({ error: "Target post not found." }, { status: 404 });
    }

    // Prepare prompt
    const promptText = `You are an AI assistant helping a professional generate an anonymous "Seeker" profile to match an open job role.
The professional wants to message the poster of the target role, but needs to create a relevant anonymous profile first.

Here is the professional's current known information:
- Job Title: ${user.job_title || "Unknown"}
- Company: ${user.company || "Unknown"}

Here is the Target Job Role they are interested in:
- Role: ${targetPost.role || "Unknown"}
- Skills Mentioned: ${targetPost.skills || "None"}
- Required Experience Years: ${targetPost.experience_years || 0}

Generate a suitable anonymous "Seeker" profile for the professional that highlights relevant skills and aligns with the target role, while remaining anonymous.
Output a valid JSON object matching this schema:
{
  "role": string (e.g. "Senior Frontend Developer"),
  "skills": string (comma-separated list of 3-5 relevant skills, e.g. "React, TypeScript, Next.js"),
  "experience_years": number (e.g. 5)
}

Output ONLY valid JSON.`;

    let modelName = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
    let response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 500,
        messages: [{ role: "user", content: promptText }],
      }),
    });

    // Fallback if haiku-4-5 is not available
    if (response.status === 404 && !process.env.ANTHROPIC_MODEL && modelName === "claude-haiku-4-5-20251001") {
      modelName = "claude-sonnet-4-6";
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          max_tokens: 500,
          messages: [{ role: "user", content: promptText }],
        }),
      });
    }

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to generate profile with AI." }, { status: 502 });
    }

    const result = await response.json();
    let textOut = result.content?.[0]?.text || "";
    textOut = textOut.trim().replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();

    const parsedData = JSON.parse(textOut);

    return NextResponse.json({
      role: parsedData.role || targetPost.role,
      skills: parsedData.skills || targetPost.skills,
      experience_years: parsedData.experience_years || targetPost.experience_years
    });
  } catch (error: any) {
    console.error("AI auto-draft error:", error);
    return NextResponse.json({ error: "Failed to process text." }, { status: 500 });
  }
}

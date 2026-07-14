import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ suggestions: [] });
  }

  const supabase = createAdminClient();

  try {
    // 1. Search database for real active users matching company or job title
    const { data: dbMatches, error: dbError } = await supabase
      .from("users")
      .select("id, job_title, company")
      .eq("is_active", true)
      .neq("id", user.id)
      .or(`company.ilike.%${query}%,job_title.ilike.%${query}%`)
      .limit(3);

    if (dbError) {
      console.error("DB Search error:", dbError);
    }

    if (dbMatches && dbMatches.length > 0) {
      return NextResponse.json({
        suggestions: dbMatches.map((m) => ({
          id: m.id,
          job_title: m.job_title,
          company: m.company,
          isSimulated: false,
        })),
      });
    }

    // 2. If no database matches found, generate using Anthropic AI
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Fallback mock suggestion if API key is not set
      const mockRole = query.toLowerCase().includes("ey") ? "Senior Manager" : "Software Engineer";
      const mockComp = query.toUpperCase();
      const mockEmail = `simulated-${crypto.randomUUID()}@proxnet.in`;

      const { data: newUser } = await supabase
        .from("users")
        .insert({
          email: mockEmail,
          full_name: `${mockRole} @ ${mockComp}`,
          job_title: mockRole,
          company: mockComp,
          source: "simulated",
          is_active: true,
          visibility: { showCompany: true, showTitle: true, showPhoto: true },
        })
        .select("id, job_title, company")
        .single();

      return NextResponse.json({
        suggestions: newUser ? [{ id: newUser.id, job_title: newUser.job_title, company: newUser.company, isSimulated: true }] : [],
      });
    }

    const systemPrompt = `You are a professional local networking matcher. The user is searching for a professional using the query "${query}".
Generate exactly 1 plausible professional job title and company that fits the query.
For example, if the query is "EY", suggest "Senior Manager" at "EY".
If the query is "Google", suggest "Software Engineer" at "Google".
If the query is "Product", suggest "Product Manager" at a well known local tech company.

Return ONLY a valid JSON array containing exactly 1 object with "job_title" and "company" properties. Do not wrap in markdown block. Do not add any explanation or other text.`;

    const modelName = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        system: systemPrompt,
        max_tokens: 250,
        messages: [{ role: "user", content: `Generate suggestion for query: "${query}"` }],
      }),
    });

    if (!aiRes.ok) {
      throw new Error(`Anthropic AI suggestions fail: ${await aiRes.text()}`);
    }

    const aiData = await aiRes.json();
    const aiText = aiData.content?.[0]?.text?.trim() || "[]";
    const parsed = JSON.parse(aiText.replace(/```json/g, "").replace(/```/g, "").trim());

    const suggestions = [];
    for (const item of parsed) {
      if (item.job_title && item.company) {
        // Create a simulated professional in the database on demand
        const mockEmail = `simulated-${crypto.randomUUID()}@proxnet.in`;
        const { data: newUser } = await supabase
          .from("users")
          .insert({
            email: mockEmail,
            full_name: `${item.job_title} @ ${item.company}`,
            job_title: item.job_title,
            company: item.company,
            source: "simulated",
            is_active: true,
            visibility: { showCompany: true, showTitle: true, showPhoto: true },
          })
          .select("id, job_title, company")
          .single();

        if (newUser) {
          suggestions.push({
            id: newUser.id,
            job_title: newUser.job_title,
            company: newUser.company,
            isSimulated: true,
          });
        }
      }
    }

    return NextResponse.json({ suggestions });

  } catch (error: any) {
    console.error("Search suggestion generate error:", error);
    return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 });
  }
}

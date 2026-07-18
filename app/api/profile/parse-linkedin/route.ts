import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url") || "";

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: "OpenAI not configured" }, { status: 500 });
  }

  try {
    const systemPrompt = "You are a specialized parser. Given a LinkedIn URL, analyze the slug/username text and try to extract the likely Name, Company name, and Job Title/Designation if they are written in the URL text. Return only a raw JSON object with keys: full_name (string or null), company (string or null), job_title (string or null). Make sure it's valid JSON without markdown wrapping.";
    const userPrompt = `LinkedIn URL: ${url}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API failed: ${errText}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content.replace(/```json/g, "").replace(/```/g, "").trim());

    return NextResponse.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error("Error parsing LinkedIn URL:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

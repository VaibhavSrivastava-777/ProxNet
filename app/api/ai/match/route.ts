import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

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
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: "Please provide a job description or resume." },
        { status: 400 }
      );
    }

    const promptText = `Analyze the following job description or resume text.
Extract the target job titles and target companies mentioned or implied.
Also write a brief 1-2 sentence anonymous pitch summarizing the opportunity or candidate.

Output a valid JSON object matching this schema:
{
  "titles": string[] (array of top 3 job titles, e.g. ["Software Engineer", "Frontend Developer"]),
  "companies": string[] (array of target companies mentioned, e.g. ["Google", "Microsoft"], empty if none),
  "pitch": string (a short, compelling anonymous message to send to matches)
}

Input text:
${text}

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
        max_tokens: 1024,
        messages: [{ role: "user", content: promptText }],
      }),
    });

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
          max_tokens: 1024,
          messages: [{ role: "user", content: promptText }],
        }),
      });
    }

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to parse with AI" }, { status: 502 });
    }

    const result = await response.json();
    let textOut = result.content?.[0]?.text || "";
    textOut = textOut.trim().replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();

    const parsedData = JSON.parse(textOut);
    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error("AI match error:", error);
    return NextResponse.json({ error: "Failed to process text." }, { status: 500 });
  }
}

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
    let pageTitle = "";
    let metaDescription = "";
    let ogTitle = "";

    // 1. Attempt to fetch public HTML metadata tags from the LinkedIn page
    try {
      const fetchRes = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        signal: AbortSignal.timeout(6000) // 6 seconds timeout
      });

      if (fetchRes.ok) {
        const html = await fetchRes.text();
        
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch) {
          pageTitle = titleMatch[1];
        }

        const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                             html.match(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i);
        if (ogTitleMatch) {
          ogTitle = ogTitleMatch[1];
        }

        const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
                          html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                          html.match(/<meta\s+name=["']twitter:description["']\s+content=["']([^"']+)["']/i);
        if (descMatch) {
          metaDescription = descMatch[1];
        }
      }
    } catch (fetchErr) {
      console.warn("Failed to fetch public HTML from LinkedIn URL (likely blocked or rate limited):", fetchErr);
    }

    // 2. Query OpenAI to parse details from url slug, page title, and meta description
    const systemPrompt = `You are a specialized profile data extractor. Given a LinkedIn URL, its page title, and meta description, extract the person's name (full_name), their current company (company), and their job title or designation (job_title).
You must output a raw valid JSON object ONLY. Make sure it has keys:
{
  "full_name": "string (null if not found)",
  "company": "string (null if not found)",
  "job_title": "string (null if not found)"
}
Return only the raw JSON. Do not wrap it in markdown block tags.`;

    const userPrompt = `LinkedIn URL: ${url}
Extracted Page Title: ${pageTitle}
Extracted OG Title: ${ogTitle}
Extracted Meta Description: ${metaDescription}`;

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
    
    // Robustly extract the JSON object from the response (in case of markdown wrappers)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : "{}";
    const parsed = JSON.parse(jsonStr);

    return NextResponse.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error("Error parsing LinkedIn URL:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

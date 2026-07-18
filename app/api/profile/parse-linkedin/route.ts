import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

// Social preview bot user agents that LinkedIn whitelists for OG meta tag access
const SOCIAL_BOT_USER_AGENTS = [
  "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "Twitterbot/1.0",
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
];

function extractMetaContent(html: string, property: string): string {
  // Try property="..." content="..." format
  const propRegex = new RegExp(
    `<meta\\s+(?:[^>]*?)?(?:property|name)=["']${property}["'][^>]*?content=["']([^"']+)["']`,
    "i"
  );
  const match1 = html.match(propRegex);
  if (match1) return match1[1];

  // Try content="..." property="..." format (reversed attribute order)
  const revRegex = new RegExp(
    `<meta\\s+(?:[^>]*?)?content=["']([^"']+)["'][^>]*?(?:property|name)=["']${property}["']`,
    "i"
  );
  const match2 = html.match(revRegex);
  if (match2) return match2[1];

  return "";
}

async function fetchLinkedInMetadata(url: string): Promise<{
  pageTitle: string;
  ogTitle: string;
  ogDescription: string;
  metaDescription: string;
}> {
  const result = { pageTitle: "", ogTitle: "", ogDescription: "", metaDescription: "" };

  for (const ua of SOCIAL_BOT_USER_AGENTS) {
    try {
      const fetchRes = await fetch(url, {
        headers: {
          "User-Agent": ua,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });

      if (!fetchRes.ok) continue;

      const html = await fetchRes.text();

      // Skip if we got a login page instead of real profile content
      if (html.includes("authwall") || html.includes("login?session_redirect")) continue;

      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) result.pageTitle = titleMatch[1].trim();

      const ogT = extractMetaContent(html, "og:title");
      if (ogT) result.ogTitle = ogT;

      const ogD = extractMetaContent(html, "og:description");
      if (ogD) result.ogDescription = ogD;

      const desc = extractMetaContent(html, "description");
      if (desc) result.metaDescription = desc;

      // Also try twitter:title as fallback
      if (!result.ogTitle) {
        const twTitle = extractMetaContent(html, "twitter:title");
        if (twTitle) result.ogTitle = twTitle;
      }
      if (!result.ogDescription) {
        const twDesc = extractMetaContent(html, "twitter:description");
        if (twDesc) result.ogDescription = twDesc;
      }

      // If we got real data, stop trying more user agents
      if (result.ogTitle || result.ogDescription || result.pageTitle) {
        console.log(`[parse-linkedin] Successfully fetched metadata with user-agent: ${ua.split("/")[0]}`);
        break;
      }
    } catch (fetchErr) {
      console.warn(`[parse-linkedin] Fetch failed with UA ${ua.split("/")[0]}:`, fetchErr);
      continue;
    }
  }

  return result;
}

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
    // 1. Fetch LinkedIn profile metadata using social bot user agents
    const metadata = await fetchLinkedInMetadata(url);

    console.log("[parse-linkedin] Extracted metadata:", {
      pageTitle: metadata.pageTitle?.substring(0, 100),
      ogTitle: metadata.ogTitle?.substring(0, 100),
      ogDescription: metadata.ogDescription?.substring(0, 200),
      metaDescription: metadata.metaDescription?.substring(0, 200),
    });

    // 2. Query OpenAI to parse profile details
    const systemPrompt = `You are a specialized LinkedIn profile data extractor. Given a LinkedIn URL and any extracted page metadata (title, OG tags, description), extract the following information:

1. **full_name**: The person's full name
2. **company**: Their current company/employer
3. **job_title**: Their current job title or designation
4. **professional_bio**: A concise 2-3 sentence professional bio about this person based on all available information

LinkedIn OG titles typically follow the format: "FirstName LastName - Job Title - Company | LinkedIn"
LinkedIn OG descriptions typically contain a summary of their experience.

You must output a raw valid JSON object ONLY with these keys:
{
  "full_name": "string or null",
  "company": "string or null",
  "job_title": "string or null",
  "professional_bio": "string or null"
}

Rules:
- Extract actual values from the metadata. Do not fabricate information.
- If a field cannot be determined from the available data, set it to null.
- For professional_bio, synthesize available information into a concise professional summary. If no information is available beyond the URL slug, set to null.
- Return only raw JSON. No markdown code blocks.`;

    const userPrompt = `LinkedIn URL: ${url}
Page Title: ${metadata.pageTitle || "(not available)"}
OG Title: ${metadata.ogTitle || "(not available)"}
OG Description: ${metadata.ogDescription || "(not available)"}
Meta Description: ${metadata.metaDescription || "(not available)"}`;

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
    
    // Robustly extract the JSON object from the response (handles markdown wrappers)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : "{}";
    const parsed = JSON.parse(jsonStr);

    console.log("[parse-linkedin] Parsed result:", parsed);

    return NextResponse.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error("[parse-linkedin] Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

// LinkedIn serves JSON-LD structured data even on auth-wall pages when accessed
// with social preview bot user agents. We extract profile data from this.
const FETCH_USER_AGENTS = [
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "Twitterbot/1.0",
];

interface LinkedInProfileData {
  name: string | null;
  company: string | null;
  jobTitle: string | null;
  description: string | null;
  location: string | null;
  education: string[];
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function extractJsonLdData(html: string): LinkedInProfileData {
  const result: LinkedInProfileData = {
    name: null,
    company: null,
    jobTitle: null,
    description: null,
    location: null,
    education: [],
  };

  // Find all JSON-LD script blocks
  const jsonLdRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);

      // Look for ProfilePage type (LinkedIn's main structured data)
      if (data["@type"] === "ProfilePage" && data.mainEntity) {
        const person = data.mainEntity;

        if (person.name) result.name = person.name;

        // Extract company from worksFor array
        if (Array.isArray(person.worksFor)) {
          for (const org of person.worksFor) {
            if (org.name) {
              result.company = org.name;
              break; // Take the first (current) employer
            }
          }
        }

        // Extract job title
        if (Array.isArray(person.jobTitle)) {
          for (const title of person.jobTitle) {
            if (title && typeof title === "string" && title.trim()) {
              result.jobTitle = title.trim();
              break;
            }
          }
        } else if (typeof person.jobTitle === "string" && person.jobTitle.trim()) {
          result.jobTitle = person.jobTitle.trim();
        }

        // Extract description/bio
        if (person.description) {
          result.description = stripHtmlTags(person.description);
        }

        // Extract location
        if (person.address?.addressLocality) {
          result.location = person.address.addressLocality;
        }

        // Extract education
        if (Array.isArray(person.alumniOf)) {
          for (const edu of person.alumniOf) {
            if (edu.name && edu.name.trim()) {
              result.education.push(edu.name.trim());
            }
          }
        }

        break; // Found the profile data, no need to check more JSON-LD blocks
      }
    } catch {
      // Invalid JSON, skip this block
      continue;
    }
  }

  return result;
}

function extractMetaContent(html: string, property: string): string {
  const propRegex = new RegExp(
    `<meta\\s+(?:[^>]*?)?(?:property|name)=["']${property}["'][^>]*?content=["']([^"']+)["']`,
    "i"
  );
  const match = html.match(propRegex);
  if (match) return match[1];

  const revRegex = new RegExp(
    `<meta\\s+(?:[^>]*?)?content=["']([^"']+)["'][^>]*?(?:property|name)=["']${property}["']`,
    "i"
  );
  const match2 = html.match(revRegex);
  if (match2) return match2[1];

  return "";
}

async function fetchLinkedInData(url: string): Promise<{
  jsonLd: LinkedInProfileData;
  ogTitle: string;
  ogDescription: string;
  pageTitle: string;
}> {
  const empty = {
    jsonLd: { name: null, company: null, jobTitle: null, description: null, location: null, education: [] } as LinkedInProfileData,
    ogTitle: "",
    ogDescription: "",
    pageTitle: "",
  };

  for (const ua of FETCH_USER_AGENTS) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": ua,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) continue;

      const html = await res.text();

      // Extract JSON-LD structured data (primary source — very rich)
      const jsonLd = extractJsonLdData(html);

      // Also extract OG meta tags as supplementary data
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1].trim() : "";
      const ogTitle = extractMetaContent(html, "og:title");
      const ogDescription = extractMetaContent(html, "og:description");

      // If we got any real data, return it
      if (jsonLd.name || ogTitle || pageTitle) {
        const label = ua.split("/")[0].split("(")[0].trim();
        console.log(`[parse-linkedin] Success with UA: ${label}`);
        return { jsonLd, ogTitle, ogDescription, pageTitle };
      }
    } catch (err) {
      const label = ua.split("/")[0].split("(")[0].trim();
      console.warn(`[parse-linkedin] Fetch failed with UA ${label}:`, err);
      continue;
    }
  }

  return empty;
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
    // 1. Fetch LinkedIn profile data (JSON-LD + OG meta tags)
    const fetched = await fetchLinkedInData(url);

    console.log("[parse-linkedin] JSON-LD data:", {
      name: fetched.jsonLd.name,
      company: fetched.jsonLd.company,
      jobTitle: fetched.jsonLd.jobTitle,
      description: fetched.jsonLd.description?.substring(0, 100),
      location: fetched.jsonLd.location,
      education: fetched.jsonLd.education,
    });

    // 2. If we have JSON-LD data, we can build the result directly without OpenAI
    const hasJsonLd = fetched.jsonLd.name || fetched.jsonLd.company;

    if (hasJsonLd) {
      // Build professional bio from available data using OpenAI for quality
      const bioContext = [
        fetched.jsonLd.name ? `Name: ${fetched.jsonLd.name}` : null,
        fetched.jsonLd.company ? `Company: ${fetched.jsonLd.company}` : null,
        fetched.jsonLd.jobTitle ? `Job Title: ${fetched.jsonLd.jobTitle}` : null,
        fetched.jsonLd.description ? `Self-description: ${fetched.jsonLd.description}` : null,
        fetched.jsonLd.location ? `Location: ${fetched.jsonLd.location}` : null,
        fetched.jsonLd.education.length > 0 ? `Education: ${fetched.jsonLd.education.join(", ")}` : null,
      ].filter(Boolean).join("\n");

      let professionalBio: string | null = null;
      let inferredJobTitle: string | null = fetched.jsonLd.jobTitle;

      // Use OpenAI to generate a professional bio AND infer missing job title
      try {
        const needsJobTitle = !inferredJobTitle;
        const ogContext = fetched.ogTitle ? `\nOG Title (format is usually "Name - Title - Company | LinkedIn"): ${fetched.ogTitle}` : "";
        const pageContext = fetched.pageTitle ? `\nPage Title: ${fetched.pageTitle}` : "";

        const systemContent = needsJobTitle
          ? `Given the LinkedIn profile data, do two things:
1. Determine the person's current job title/designation from available context (especially the OG Title which follows "Name - Job Title - Company | LinkedIn" format).
2. Write a concise 2-3 sentence professional bio in third person. CRITICAL INSTRUCTION: You MUST NOT mention the person's name anywhere in the bio under ANY circumstances. Start the bio directly with their professional identity (e.g., "A seasoned professional..."). Be factual, do not fabricate.

Return raw JSON only:
{"job_title": "string or null", "professional_bio": "string or null"}`
          : `Write a concise 2-3 sentence professional bio for this person based on the data provided. Write in third person. CRITICAL INSTRUCTION: You MUST NOT mention the person's name anywhere in the bio under ANY circumstances. Start the bio directly with their professional identity (e.g., "A seasoned professional..."). Be factual, do not fabricate.

Return raw JSON only:
{"professional_bio": "string or null"}`;

        const bioRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemContent },
              { role: "user", content: bioContext + ogContext + pageContext },
            ],
            temperature: 0.2,
            max_tokens: 300,
          }),
        });

        if (bioRes.ok) {
          const bioData = await bioRes.json();
          const content = bioData.choices?.[0]?.message?.content?.trim() || "{}";
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
          if (parsed.professional_bio) professionalBio = parsed.professional_bio;
          if (needsJobTitle && parsed.job_title) inferredJobTitle = parsed.job_title;
        }
      } catch (bioErr) {
        console.warn("[parse-linkedin] Failed to generate bio/title via OpenAI:", bioErr);
      }

      const result = {
        full_name: fetched.jsonLd.name || null,
        company: fetched.jsonLd.company || null,
        job_title: inferredJobTitle || null,
        professional_bio: professionalBio,
      };

      console.log("[parse-linkedin] Final result (JSON-LD path):", result);
      return NextResponse.json({ success: true, data: result });
    }

    // 3. Fallback: Use OpenAI to parse from OG tags and URL slug
    const systemPrompt = `You are a LinkedIn profile data extractor. Given a LinkedIn URL and any page metadata, extract:
- full_name: The person's full name
- company: Their current company
- job_title: Their current job title
- professional_bio: A 2-3 sentence professional bio. CRITICAL INSTRUCTION: You MUST NOT mention the person's name anywhere in the bio under ANY circumstances. Start the bio directly with their professional identity (e.g., "A seasoned professional..."). (null if insufficient data)

Output raw JSON only. No markdown. Set fields to null if unknown. Do not fabricate.`;

    const userPrompt = `LinkedIn URL: ${url}
Page Title: ${fetched.pageTitle || "(not available)"}
OG Title: ${fetched.ogTitle || "(not available)"}
OG Description: ${fetched.ogDescription || "(not available)"}`;

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
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : "{}";
    const parsed = JSON.parse(jsonStr);

    console.log("[parse-linkedin] Final result (OG fallback path):", parsed);
    return NextResponse.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error("[parse-linkedin] Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

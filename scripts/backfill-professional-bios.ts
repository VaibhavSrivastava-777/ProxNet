/**
 * Script to backfill professional bios for all users.
 * Run: npx tsx scripts/backfill-professional-bios.ts
 * Requires:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - OPENAI_API_KEY
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load local environment variables
dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_KEY) {
  console.error("❌ Error: Missing credentials. Ensure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and OPENAI_API_KEY are in .env.local.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

  const jsonLdRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      if (data["@type"] === "ProfilePage" && data.mainEntity) {
        const person = data.mainEntity;
        if (person.name) result.name = person.name;

        if (Array.isArray(person.worksFor)) {
          for (const org of person.worksFor) {
            if (org.name) {
              result.company = org.name;
              break;
            }
          }
        }

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

        if (person.description) {
          result.description = stripHtmlTags(person.description);
        }

        if (person.address?.addressLocality) {
          result.location = person.address.addressLocality;
        }

        if (Array.isArray(person.alumniOf)) {
          for (const edu of person.alumniOf) {
            if (edu.name && edu.name.trim()) {
              result.education.push(edu.name.trim());
            }
          }
        }
        break;
      }
    } catch {
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

async function fetchLinkedInData(url: string) {
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
      const jsonLd = extractJsonLdData(html);
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1].trim() : "";
      const ogTitle = extractMetaContent(html, "og:title");
      const ogDescription = extractMetaContent(html, "og:description");

      if (jsonLd.name || ogTitle || pageTitle) {
        return { jsonLd, ogTitle, ogDescription, pageTitle };
      }
    } catch (err) {
      continue;
    }
  }
  return null;
}

async function generateBioWithOpenAI(bioContext: string, systemPrompt: string): Promise<string | null> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: bioContext },
        ],
        temperature: 0.2,
        max_tokens: 300,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    }
  } catch (err) {
    console.error("  ⚠️ OpenAI error:", err);
  }
  return null;
}

async function processUser(user: any): Promise<string | null> {
  // Option 1: Try scraping LinkedIn profile if they have URL
  if (user.linkedin_profile_url && user.linkedin_profile_url.includes("linkedin.com")) {
    console.log(`  Scraping LinkedIn for ${user.full_name}...`);
    const fetched = await fetchLinkedInData(user.linkedin_profile_url);

    if (fetched && (fetched.jsonLd.name || fetched.jsonLd.company)) {
      const bioContext = [
        fetched.jsonLd.name ? `Name: ${fetched.jsonLd.name}` : `Name: ${user.full_name}`,
        fetched.jsonLd.company ? `Company: ${fetched.jsonLd.company}` : (user.company ? `Company: ${user.company}` : null),
        fetched.jsonLd.jobTitle ? `Job Title: ${fetched.jsonLd.jobTitle}` : (user.job_title ? `Job Title: ${user.job_title}` : null),
        fetched.jsonLd.description ? `Self-description: ${fetched.jsonLd.description}` : null,
        fetched.jsonLd.location ? `Location: ${fetched.jsonLd.location}` : null,
        fetched.jsonLd.education.length > 0 ? `Education: ${fetched.jsonLd.education.join(", ")}` : null,
        user.about ? `About Section: ${user.about}` : null,
      ].filter(Boolean).join("\n");

      const needsJobTitle = !fetched.jsonLd.jobTitle && !user.job_title;
      const ogContext = fetched.ogTitle ? `\nOG Title: ${fetched.ogTitle}` : "";
      const pageContext = fetched.pageTitle ? `\nPage Title: ${fetched.pageTitle}` : "";

      const systemPrompt = needsJobTitle
        ? `Given the LinkedIn profile data, do two things:
1. Determine the person's current job title/designation from available context (especially OG Title/Page Title).
2. Write a concise 2-3 sentence professional bio in third person. Be factual.

Return raw JSON only:
{"job_title": "string or null", "professional_bio": "string or null"}`
        : `Write a concise 2-3 sentence professional bio for this person based on the data provided. Write in third person. Be factual.

Return raw JSON only:
{"professional_bio": "string or null"}`;

      const aiResponse = await generateBioWithOpenAI(bioContext + ogContext + pageContext, systemPrompt);
      if (aiResponse) {
        try {
          const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
          
          if (needsJobTitle && parsed.job_title) {
            console.log(`  Updating job title: "${parsed.job_title}"`);
            await supabase.from("users").update({ job_title: parsed.job_title }).eq("id", user.id);
          }

          if (parsed.professional_bio) return parsed.professional_bio;
        } catch {
          return aiResponse;
        }
      }
    }
  }

  // Option 2: Synthesize bio from local DB data
  console.log(`  Synthesizing bio from local data for ${user.full_name}...`);
  const bioContext = [
    `Name: ${user.full_name}`,
    user.company ? `Company: ${user.company}` : null,
    user.job_title ? `Job Title: ${user.job_title}` : null,
    user.about ? `About: ${user.about}` : null,
    user.resume_text ? `Resume Text Summary: ${user.resume_text.substring(0, 1500)}` : null,
  ].filter(Boolean).join("\n");

  const systemPrompt = `Write a concise 2-3 sentence professional bio for this person based on the profile data provided. Write in third person. Be factual. If the data is extremely limited, return a short one-sentence bio. Return ONLY the bio text, no quotes or formatting.`;

  return await generateBioWithOpenAI(bioContext, systemPrompt);
}

async function main() {
  console.log("🚀 Fetching users needing professional bio backfill...");
  const { data: users, error } = await supabase
    .from("users")
    .select("id, full_name, company, job_title, about, resume_text, linkedin_profile_url, professional_bio")
    .is("professional_bio", null);

  if (error) {
    console.error("❌ Failed to fetch users:", error);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log("✅ All users already have professional bios. Nothing to backfill!");
    return;
  }

  console.log(`📋 Found ${users.length} users to process.`);

  let successCount = 0;
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    console.log(`\nProcessing user [${i + 1}/${users.length}]: ${user.full_name} (${user.id})`);
    
    try {
      const bio = await processUser(user);
      if (bio) {
        const { error: updateErr } = await supabase
          .from("users")
          .update({ professional_bio: bio })
          .eq("id", user.id);

        if (updateErr) {
          console.error(`  ❌ Failed to update Supabase for ${user.full_name}:`, updateErr);
        } else {
          console.log(`  ✅ Successfully backfilled bio: "${bio}"`);
          successCount++;
        }
      } else {
        console.log(`  ⚠️ Could not generate bio for ${user.full_name}`);
      }
    } catch (err: any) {
      console.error(`  ❌ Error processing ${user.full_name}:`, err?.message || err);
    }

    // Small delay between calls to be nice to rate limits
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  console.log(`\n🎉 Backfill complete! Successfully backfilled bios for ${successCount}/${users.length} users.`);
}

main().catch(console.error);

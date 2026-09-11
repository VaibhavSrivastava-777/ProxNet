/**
 * LinkedIn Profile Scraper & Missing Field Enricher
 *
 * Reads LinkedIn URL(s), scrapes the profile using social bot preview data (JSON-LD, OG tags),
 * and uses OpenAI to extract and fill in missing fields (company, designation/job_title, full_name, bio).
 *
 * Usage:
 *   # Scrape a specific LinkedIn URL:
 *   npx tsx scripts/scrape-linkedin-profile.ts "https://www.linkedin.com/in/gauravjains2003"
 *
 *   # Scrape a specific user by ID or Email:
 *   npx tsx scripts/scrape-linkedin-profile.ts --user="gauravjains2003@gmail.com"
 *
 *   # Scan and enrich ALL users in DB with missing company/designation who have a LinkedIn URL:
 *   npx tsx scripts/scrape-linkedin-profile.ts --all
 *
 *   # Dry-run (scrape and preview changes without writing to DB):
 *   npx tsx scripts/scrape-linkedin-profile.ts --all --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Error: Missing Supabase credentials in .env.local.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const FETCH_USER_AGENTS = [
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "Twitterbot/1.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
];

export interface ScrapedLinkedInData {
  full_name: string | null;
  company: string | null;
  job_title: string | null;
  location: string | null;
  professional_bio: string | null;
  rawJsonLd?: any;
  ogTitle?: string;
  ogDescription?: string;
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
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

export async function fetchLinkedInRaw(url: string): Promise<{
  html: string;
  pageTitle: string;
  ogTitle: string;
  ogDescription: string;
  jsonLdData: any;
}> {
  // Normalize URL
  let cleanUrl = url.trim();
  if (!cleanUrl.startsWith("http")) {
    cleanUrl = `https://${cleanUrl}`;
  }

  for (const ua of FETCH_USER_AGENTS) {
    try {
      const res = await fetch(cleanUrl, {
        headers: {
          "User-Agent": ua,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) continue;

      const html = await res.text();
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1].trim() : "";
      const ogTitle = extractMetaContent(html, "og:title");
      const ogDescription = extractMetaContent(html, "og:description");

      // Extract JSON-LD script blocks
      let jsonLdData: any = null;
      const jsonLdRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let match;
      while ((match = jsonLdRegex.exec(html)) !== null) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed["@type"] === "ProfilePage" || parsed["@type"] === "Person" || parsed.mainEntity) {
            jsonLdData = parsed;
            break;
          }
          if (!jsonLdData) {
            jsonLdData = parsed;
          }
        } catch {
          // ignore parse error
        }
      }

      if (pageTitle || ogTitle || jsonLdData) {
        return { html, pageTitle, ogTitle, ogDescription, jsonLdData };
      }
    } catch (err: any) {
      // try next UA
    }
  }

  return { html: "", pageTitle: "", ogTitle: "", ogDescription: "", jsonLdData: null };
}

export async function scrapeLinkedInProfile(url: string): Promise<ScrapedLinkedInData> {
  console.log(`  🌐 Scraping LinkedIn URL: ${url}`);
  const raw = await fetchLinkedInRaw(url);

  if (!raw.pageTitle && !raw.ogTitle && !raw.jsonLdData) {
    throw new Error(`Unable to fetch preview data from LinkedIn for URL: ${url}`);
  }

  if (
    raw.pageTitle.includes("Profile Not Found") ||
    raw.ogTitle?.includes("Profile Not Found") ||
    raw.pageTitle.includes("Page not found")
  ) {
    throw new Error(`Profile Not Found on LinkedIn (URL may be deleted or username invalid: ${url})`);
  }

  console.log(`  📄 Discovered Metadata:`);
  if (raw.ogTitle) console.log(`     - OG Title: "${raw.ogTitle}"`);
  if (raw.ogDescription) console.log(`     - OG Description: "${raw.ogDescription.slice(0, 100)}..."`);
  if (raw.pageTitle) console.log(`     - Page Title: "${raw.pageTitle}"`);
  if (raw.jsonLdData) console.log(`     - JSON-LD Structured Data: Present`);

  // Direct extraction from JSON-LD if available
  let extractedName: string | null = null;
  let extractedCompany: string | null = null;
  let extractedJobTitle: string | null = null;
  let extractedLocation: string | null = null;
  let extractedBio: string | null = null;

  if (raw.jsonLdData) {
    const entity = raw.jsonLdData.mainEntity || raw.jsonLdData;
    if (entity.name) extractedName = entity.name;
    if (Array.isArray(entity.worksFor) && entity.worksFor[0]?.name) {
      extractedCompany = entity.worksFor[0].name;
    }
    if (typeof entity.jobTitle === "string") {
      extractedJobTitle = entity.jobTitle;
    } else if (Array.isArray(entity.jobTitle) && entity.jobTitle[0]) {
      extractedJobTitle = entity.jobTitle[0];
    }
    if (entity.address?.addressLocality) {
      extractedLocation = entity.address.addressLocality;
    }
    if (entity.description) {
      extractedBio = stripHtmlTags(entity.description);
    }
  }
  // Use OpenAI gpt-4o-mini to synthesize and verify high quality structured fields
  if (OPENAI_KEY) {
    try {
      const systemPrompt = `You are an expert LinkedIn profile information extractor.
Given raw LinkedIn metadata (OG Title, Page Title, OG Description, JSON-LD), extract the individual's:
1. full_name: The person's full name (omit credentials like FRM, PMP from name if possible).
2. company: The person's CURRENT company or organization.
3. job_title: The person's CURRENT job title / designation / primary professional role. If not explicitly stated as a separate word in the title (for example, if they have a tagline or narrative in the description), deduce a standard, professional job title/designation matching their domain and level of work (e.g. "Incident Management Specialist", "Data Governance & Risk Manager", etc.). Do NOT leave null if their professional domain is clear.
4. location: City, State, or Region if present.
5. professional_bio: A high quality, 2-3 sentence professional bio in third person based on their experience.
   CRITICAL: Do NOT mention the person's name anywhere in the bio. Start directly with their professional identity (e.g. "A seasoned Incident Manager with over 18 years of experience...").

Return RAW JSON only with this schema:
{
  "full_name": "string or null",
  "company": "string or null",
  "job_title": "string or null",
  "location": "string or null",
  "professional_bio": "string or null"
}`;

      const userPrompt = [
        `URL: ${url}`,
        raw.ogTitle ? `OG Title: ${raw.ogTitle}` : null,
        raw.pageTitle ? `Page Title: ${raw.pageTitle}` : null,
        raw.ogDescription ? `OG Description: ${raw.ogDescription}` : null,
        extractedName ? `Pre-extracted Name: ${extractedName}` : null,
        extractedCompany ? `Pre-extracted Company: ${extractedCompany}` : null,
        extractedJobTitle ? `Pre-extracted Job Title: ${extractedJobTitle}` : null,
        extractedLocation ? `Pre-extracted Location: ${extractedLocation}` : null,
        extractedBio ? `Pre-extracted Description: ${extractedBio}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_KEY}`,
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

      if (aiRes.ok) {
        const aiJson = await aiRes.json();
        const content = aiJson.choices?.[0]?.message?.content || "{}";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            full_name: parsed.full_name || extractedName,
            company: parsed.company || extractedCompany,
            job_title: parsed.job_title || extractedJobTitle,
            location: parsed.location || extractedLocation,
            professional_bio: parsed.professional_bio || extractedBio,
            ogTitle: raw.ogTitle,
            ogDescription: raw.ogDescription,
          };
        }
      }
    } catch (openAiErr) {
      console.warn("  ⚠️ OpenAI enrichment failed, falling back to rule-based extraction:", openAiErr);
    }
  }

  // Fallback rule-based parsing from OG Title
  let titleParts = (raw.ogTitle || raw.pageTitle || "").replace(/\s*\|\s*LinkedIn\s*$/i, "").split(" - ");
  if (!extractedName && titleParts[0]) extractedName = titleParts[0].trim();
  if (!extractedJobTitle && titleParts.length >= 3) extractedJobTitle = titleParts[1].trim();
  if (!extractedCompany && titleParts.length >= 2) {
    extractedCompany = titleParts.length >= 3 ? titleParts.slice(2).join(" - ").trim() : titleParts[1].trim();
  }

  return {
    full_name: extractedName,
    company: extractedCompany,
    job_title: extractedJobTitle,
    location: extractedLocation,
    professional_bio: extractedBio,
    ogTitle: raw.ogTitle,
    ogDescription: raw.ogDescription,
  };
}

async function enrichUser(
  user: {
    id: string;
    full_name: string | null;
    email: string | null;
    company: string | null;
    job_title: string | null;
    professional_bio: string | null;
    linkedin_profile_url: string;
  },
  options: { dryRun?: boolean; force?: boolean },
  preScraped?: ScrapedLinkedInData
) {
  console.log(`\n------------------------------------------------------------`);
  console.log(`👤 Processing User: ${user.full_name || "Unnamed"} (${user.id})`);
  console.log(`   Email: ${user.email || "N/A"}`);
  console.log(`   LinkedIn: ${user.linkedin_profile_url}`);
  console.log(`   Current State:`);
  console.log(`     - Company:     "${user.company || ""}"`);
  console.log(`     - Designation: "${user.job_title || ""}"`);
  console.log(`     - Bio:         "${user.professional_bio ? user.professional_bio.slice(0, 40) + "..." : ""}"`);

  const missingFields: string[] = [];
  if (!user.company?.trim()) missingFields.push("company");
  if (!user.job_title?.trim()) missingFields.push("job_title");
  if (!user.full_name?.trim()) missingFields.push("full_name");
  if (!user.professional_bio?.trim()) missingFields.push("professional_bio");

  if (missingFields.length === 0 && !options.force) {
    console.log(`   ✅ All key fields already present. Skipping.`);
    return null;
  }

  console.log(`   🔍 Missing fields to fetch: [${missingFields.join(", ")}]`);

  try {
    const scraped = preScraped || (await scrapeLinkedInProfile(user.linkedin_profile_url));

    console.log(`   ✨ Scraped LinkedIn Data:`);
    console.log(`     - Name:        "${scraped.full_name || "N/A"}"`);
    console.log(`     - Company:     "${scraped.company || "N/A"}"`);
    console.log(`     - Designation: "${scraped.job_title || "N/A"}"`);
    console.log(`     - Location:    "${scraped.location || "N/A"}"`);
    console.log(`     - Bio:         "${scraped.professional_bio || "N/A"}"`);

    const updatePayload: Record<string, any> = {};

    if ((!user.company?.trim() || options.force) && scraped.company) {
      updatePayload.company = scraped.company;
    }
    if ((!user.job_title?.trim() || options.force) && scraped.job_title) {
      updatePayload.job_title = scraped.job_title;
    }
    if ((!user.full_name?.trim() || options.force) && scraped.full_name) {
      updatePayload.full_name = scraped.full_name;
    }
    if ((!user.professional_bio?.trim() || options.force) && scraped.professional_bio) {
      updatePayload.professional_bio = scraped.professional_bio;
    }

    if (Object.keys(updatePayload).length === 0) {
      console.log(`   ⚠️ No new data could be extracted for missing fields.`);
      return null;
    }

    console.log(`   📝 Updates to apply:`, updatePayload);

    if (options.dryRun) {
      console.log(`   [DRY-RUN] Changes NOT saved to database.`);
      return { user, updatePayload, scraped, dryRun: true };
    }

    const { error: updateErr } = await supabase
      .from("users")
      .update(updatePayload)
      .eq("id", user.id);

    if (updateErr) {
      console.error(`   ❌ Failed to update Supabase:`, updateErr);
      return null;
    }

    console.log(`   🎉 Successfully updated database for ${user.full_name || user.id}!`);
    return { user, updatePayload, scraped, dryRun: false };
  } catch (err: any) {
    console.error(`   ❌ Error scraping user ${user.id}:`, err.message);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");
  const scanAll = args.includes("--all");

  const urlArg = args.find((a) => a.startsWith("http") || a.includes("linkedin.com"));
  const userArg = args.find((a) => a.startsWith("--user="))?.replace("--user=", "");

  console.log("============================================================");
  console.log("🚀 ProxNet LinkedIn Profile Scraper & Missing Field Enricher");
  console.log("============================================================");
  if (dryRun) console.log("⚙️ Mode: DRY-RUN (No database writes)");
  if (force) console.log("⚙️ Mode: FORCE (Overwrite existing fields)");

  // CASE 1: Single URL provided
  if (urlArg) {
    console.log(`\nScraping specified URL: ${urlArg}`);
    const scraped = await scrapeLinkedInProfile(urlArg);

    console.log("\n================ Extracted Profile Data ================");
    console.log(`Full Name:        ${scraped.full_name || "(not found)"}`);
    console.log(`Company:          ${scraped.company || "(not found)"}`);
    console.log(`Designation/Role: ${scraped.job_title || "(not found)"}`);
    console.log(`Location:         ${scraped.location || "(not found)"}`);
    console.log(`Professional Bio: ${scraped.professional_bio || "(not found)"}`);
    console.log("========================================================\n");

    // Check if this LinkedIn URL matches any user in our DB
    const { data: matchedUsers } = await supabase
      .from("users")
      .select("id, full_name, email, company, job_title, professional_bio, linkedin_profile_url")
      .or(`linkedin_profile_url.ilike.%${urlArg.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "")}%`);

    if (matchedUsers && matchedUsers.length > 0) {
      console.log(`Found matching user in database: ${matchedUsers[0].full_name} (${matchedUsers[0].id})`);
      await enrichUser(matchedUsers[0], { dryRun, force }, scraped);
    } else {
      console.log("Note: No user in the database currently has this LinkedIn URL registered.");
    }
    return;
  }

  // CASE 2: Specific user by ID or Email
  if (userArg) {
    console.log(`\nSearching for user by: ${userArg}`);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userArg);
    let query = supabase.from("users").select("id, full_name, email, company, job_title, professional_bio, linkedin_profile_url");
    if (isUuid) {
      query = query.eq("id", userArg);
    } else {
      query = query.ilike("email", userArg.trim());
    }
    const { data: users, error } = await query.limit(1);

    if (error || !users || users.length === 0) {
      console.error(`❌ User not found for: ${userArg}`);
      process.exit(1);
    }

    const targetUser = users[0];
    if (!targetUser.linkedin_profile_url) {
      console.error(`❌ User ${targetUser.full_name} does not have a LinkedIn profile URL on record.`);
      process.exit(1);
    }

    await enrichUser(targetUser, { dryRun, force });
    return;
  }

  // CASE 3: Scan ALL users with missing company / job_title who have LinkedIn URLs
  console.log("\nScanning database for users with LinkedIn profile URLs...");
  const { data: allUsers, error } = await supabase
    .from("users")
    .select("id, full_name, email, company, job_title, professional_bio, linkedin_profile_url");

  if (error) {
    console.error("❌ Failed to query users:", error);
    process.exit(1);
  }

  const usersWithLinkedin = (allUsers || []).filter((u) => u.linkedin_profile_url && u.linkedin_profile_url.includes("linkedin.com"));
  console.log(`Found ${usersWithLinkedin.length} users with LinkedIn URLs.`);

  const candidates = usersWithLinkedin.filter((u) => {
    if (force) return true;
    const hasCompany = Boolean(u.company?.trim());
    const hasTitle = Boolean(u.job_title?.trim());
    const hasBio = Boolean(u.professional_bio?.trim());
    return !hasCompany || !hasTitle || !hasBio;
  });

  console.log(`Found ${candidates.length} users with missing details (company, job_title, or bio).\n`);

  if (candidates.length === 0) {
    console.log("✅ All users with LinkedIn URLs already have complete company, designation, and bio details!");
    return;
  }

  let updatedCount = 0;
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    console.log(`\n[${i + 1}/${candidates.length}]`);
    const res = await enrichUser(candidate, { dryRun, force });
    if (res && Object.keys(res.updatePayload).length > 0) {
      updatedCount++;
    }
    // Polite delay between scrapes
    await new Promise((r) => setTimeout(r, 1200));
  }

  console.log("\n============================================================");
  console.log(`🎉 Finished! Successfully enriched ${updatedCount} / ${candidates.length} users.`);
  console.log("============================================================\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

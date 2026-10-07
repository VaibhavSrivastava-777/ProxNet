import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { createAdminClient } from '../lib/supabase/admin';

const INDIAN_TECH_HUBS = [
  "bangalore", "bengaluru", "mumbai", "pune", "delhi", "new delhi", "ncr",
  "gurugram", "gurgaon", "noida", "greater noida", "hyderabad", "chennai",
  "kolkata", "kochi", "cochin", "trivandrum", "thiruvananthapuram", "coimbatore",
  "chandigarh", "ahmedabad", "indore", "jaipur", "mysore", "mysuru", "mohali",
  "lucknow", "nagpur", "bhubaneswar", "visakhapatnam", "vizag", "vadodara",
  "surat", "gandhinagar", "bhopal", "patna", "ludhiana", "thane", "navi mumbai",
  "dehradun", "guwahati", "ranchi", "jamshedpur", "mangalore", "mangaluru"
];

const INDIAN_STATES = [
  "karnataka", "maharashtra", "tamil nadu", "telangana", "andhra pradesh",
  "gujarat", "haryana", "uttar pradesh", "west bengal", "kerala", "punjab",
  "rajasthan", "madhya pradesh", "odisha", "orissa", "assam", "bihar",
  "jharkhand", "chhattisgarh", "goa", "uttarakhand", "himachal pradesh"
];

const FOREIGN_DISQUALIFIERS = [
  "united states", "usa", "u.s.", "u.s.a.", "san francisco", "seattle", "new york",
  "austin", "chicago", "boston", "los angeles", "california", "texas",
  "united kingdom", "uk", "london", "emea", "latam", "apac", "canada",
  "toronto", "vancouver", "europe", "germany", "berlin", "munich",
  "france", "paris", "australia", "sydney", "melbourne", "singapore",
  "netherlands", "amsterdam", "ireland", "dublin", "israel", "tel aviv",
  "brazil", "mexico", "philippines", "poland", "spain", "madrid", "barcelona",
  "sweden", "stockholm", "switzerland", "zurich", "geneva", "japan", "tokyo",
  "atlanta", "tampa", "charlotte", "raleigh", "dallas", "houston",
  "sunnyvale", "santa clara", "mountain view", "palo alto", "redmond", "bellevue",
  "minneapolis", "denver", "boulder", "philadelphia", "pittsburgh", "detroit",
  "cleveland", "columbus", "jersey city", "louisville", "florida", "georgia",
  "north carolina", "south carolina", "virginia", "ohio", "illinois",
  "pennsylvania", "michigan", "colorado", "washington", "arizona",
  "massachusetts", "new jersey", "connecticut"
];

export function hasForeignTitleIndicators(title?: string | null): boolean {
  if (!title) return false;
  const t = title.trim();
  const tLower = t.toLowerCase();

  // 1. SuccessFactors / ATS country codes: USA-FL, USA-CA, AUS-VIC, GBR-37, CAN-ON, etc.
  if (/\b(USA-[A-Z]{2}|AUS-[A-Z]{2,3}|GBR-[A-Z0-9]+|CAN-[A-Z]{2}|DEU-[A-Z0-9]+|FRA-[A-Z0-9]+)\b/i.test(t)) {
    return true;
  }

  // 2. Explicit USA or United States
  if (/\b(usa|united states|u\.s\.a\.)\b/i.test(t)) {
    const mentionsIndia = INDIAN_TECH_HUBS.some(city => tLower.includes(city)) || /\bindia\b/i.test(tLower);
    if (!mentionsIndia) return true;
  }

  // 3. Explicit US with boundaries or suffixes (e.g. " - US", " (US)", " [US]", " / US", ", US", " – US", " — US", " US Remote")
  const usBoundaryRegex = /(?:[\-\–\—\/\|,\[\(]\s*)(?:US|U\.S\.)(?:\s*[\-\–\—\/\|,\]\)]|\s*(?:remote|only|east|west|central|north|south|region|territory|market)\b|$)/i;
  const usEndRegex = /(?:^|\s)(?:US|U\.S\.)\s*$/i;
  const usPrefixRegex = /^(?:US|U\.S\.)\s*[\-\–\—\/\|,:]/i;
  if (usBoundaryRegex.test(t) || usEndRegex.test(t) || usPrefixRegex.test(t)) {
    const mentionsIndia = INDIAN_TECH_HUBS.some(city => tLower.includes(city)) || /\bindia\b/i.test(tLower);
    if (!mentionsIndia) return true;
  }

  // 4. Foreign regions (EMEA, LATAM, North America, UK, Europe, etc.)
  const regionRegex = /(?:[\-\–\—\/\|,\[\(]\s*)(?:EMEA|LATAM|North America|United Kingdom|UK|Canada|Australia|Germany|France|Singapore|Europe)(?:[\s\)\]\-\–\—\/\|,.:]|$)/i;
  if (regionRegex.test(t)) {
    const mentionsIndia = INDIAN_TECH_HUBS.some(city => tLower.includes(city)) || /\bindia\b/i.test(tLower);
    if (!mentionsIndia) return true;
  }

  // 5. Foreign tech cities in title
  const hasForeignCity = FOREIGN_DISQUALIFIERS.some(foreign => {
    if (foreign.length <= 4) return false;
    const regex = new RegExp(`(?:^|[\\s\\(\\[\\-\\–\\—\\/\\|,])\\b${foreign}\\b(?:[\\s\\)\\]\\-\\–\\—\\/\\|,]|$|\\d)`, "i");
    return regex.test(tLower);
  });
  if (hasForeignCity) {
    const mentionsIndia = INDIAN_TECH_HUBS.some(city => tLower.includes(city)) || /\bindia\b/i.test(tLower);
    if (!mentionsIndia) return true;
  }

  return false;
}

export function isIndiaLocationCandidate(
  location?: string | null,
  description?: string | null,
  title?: string | null
): boolean {
  // 1. If title explicitly indicates foreign location, reject immediately
  if (title && hasForeignTitleIndicators(title)) {
    return false;
  }

  const loc = (location || "").toLowerCase().trim();
  const desc = (description || "").toLowerCase();

  // 2. Check if location has an Indian city or state FIRST
  const isIndianCity = INDIAN_TECH_HUBS.some(city => loc.includes(city));
  const isIndianState = INDIAN_STATES.some(state => loc.includes(state));
  const hasIndiaExplicit =
    loc.includes("india") ||
    loc === "in" ||
    loc === "ind" ||
    loc.includes("pan india") ||
    /\b(IND-\d+|IN,\s*\d+)\b/i.test(title || "") ||
    /\bindia\b/i.test(title || "");

  // If it's an Indian city or state or explicitly India, check if it's tainted by an explicit foreign marker (e.g. "USA-", "United States", "US")
  if (isIndianCity || isIndianState || hasIndiaExplicit) {
    const hasExplicitForeign =
      /\bUSA-[A-Z]{2}\b/i.test(loc) ||
      /\b(AUS-[A-Z]{2,3}|GBR-[A-Z0-9]+|CAN-[A-Z]{2}|DEU-[A-Z0-9]+|FRA-[A-Z0-9]+)\b/i.test(loc) ||
      /\b(usa|united states|u\.s\.a\.)\b/i.test(loc) ||
      /(?:[\-\–\—\/\|,\[\(]\s*)(?:US|U\.S\.)(?:\s*[\-\–\—\/\|,\]\)]|\s*(?:only|east|west)\b|$)/i.test(loc);
    
    // If it has Indian hub and no explicit foreign marker, it is a valid India job!
    if (!hasExplicitForeign) {
      return true;
    }
    // If it has explicit foreign marker (e.g. Bangalore, USA), reject
    return false;
  }

  // 3. Check for foreign indicators in location
  const hasUsaStateTag = /\bUSA-[A-Z]{2}\b/i.test(loc);
  const hasOtherCountryTag = /\b(AUS-[A-Z]{2,3}|GBR-[A-Z0-9]+|CAN-[A-Z]{2}|DEU-[A-Z0-9]+|FRA-[A-Z0-9]+)\b/i.test(loc);
  const hasUsPostalCode = /,\s*(?:al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy)\b/i.test(loc);

  const isForeignLoc = hasUsaStateTag || hasOtherCountryTag || hasUsPostalCode || FOREIGN_DISQUALIFIERS.some(foreign => {
    if (foreign.length <= 4) {
      const escaped = foreign.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i");
      return regex.test(loc);
    }
    return loc.includes(foreign);
  });

  if (isForeignLoc) {
    return false;
  }

  // 4. Handle remote designations
  const isRemote = loc.includes("remote") || loc.includes("anywhere") || loc.includes("work from home") || loc.includes("wfh");
  if (isRemote) {
    if (isForeignLoc || hasUsPostalCode) return false;

    // Check description for US-only / foreign-only restrictions
    if (desc) {
      const usOnlyPhrases = [
        "must be located in the us",
        "must be located in the united states",
        "us citizenship",
        "us work authorization",
        "authorized to work in the us without",
        "us only",
        "north america only",
        "eligible to work in the united states",
        "within the united states",
        "resident of the united states",
      ];
      if (usOnlyPhrases.some(phrase => desc.includes(phrase))) {
        return false;
      }
    }

    return true;
  }

  // 5. If location was blank or unspecified, check description
  if (!loc) {
    if (!desc) return false;
    const hasIndiaCityInDesc = INDIAN_TECH_HUBS.some(city => desc.includes(city));
    const hasIndiaWordInDesc = /\bindia\b/i.test(desc);
    return hasIndiaCityInDesc || hasIndiaWordInDesc;
  }

  return false;
}

async function main() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('scraped_jobs')
    .select('id, title, location, company, description, url, posted_at');

  console.log(`Analyzing ${data?.length} scraped jobs...`);

  let eligibleCount = 0;
  let foreignCount = 0;
  const foreignSamples: any[] = [];
  const eligibleSamples: any[] = [];

  for (const job of data || []) {
    const isIndia = isIndiaLocationCandidate(job.location, job.description, job.title);
    if (isIndia) {
      eligibleCount++;
      if (eligibleSamples.length < 5) {
        eligibleSamples.push({ company: job.company, title: job.title, loc: job.location });
      }
    } else {
      foreignCount++;
      if (foreignSamples.length < 20) {
        foreignSamples.push({ company: job.company, title: job.title, loc: job.location });
      }
    }
  }

  console.log(`Eligible India jobs: ${eligibleCount}`);
  console.log(`Disqualified foreign/USA jobs: ${foreignCount}`);
  console.log('\nSample Disqualified Foreign / USA Jobs:');
  console.table(foreignSamples);
  console.log('\nSample Kept India Jobs:');
  console.table(eligibleSamples);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });

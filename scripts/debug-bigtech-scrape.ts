import { customStrategy } from "../lib/scrape-strategies";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

function isIndianOrRemote(location: string): boolean {
  if (!location) return true; // Default to true if location omitted or generic
  const loc = location.toLowerCase().trim();
  const indianKeywords = [
    "india", "bangalore", "bengaluru", "mumbai", "pune", "delhi",
    "gurugram", "gurgaon", "noida", "hyderabad", "chennai", "kolkata",
    "kochi", "trivandrum", "coimbatore", "chandigarh", "ahmedabad",
    "indore", "jaipur", "mysore", "mohali", "lucknow", "nagpur",
    "bhubaneswar", "visakhapatnam", "vadodara", "surat", "gandhinagar",
    "maharashtra", "karnataka", "tamil nadu", "telangana", "andhra pradesh",
    "remote", "anywhere", "work from home"
  ];
  return indianKeywords.some(k => loc.includes(k));
}

async function debugCompany(name: string, url: string) {
  console.log(`\n======================================================`);
  console.log(`🔍 Debugging ${name} (${url})`);
  console.log(`======================================================`);
  try {
    const rawJobs = await customStrategy(url, name);
    console.log(`  Raw jobs extracted from Firecrawl: ${rawJobs.length}`);
    
    if (rawJobs.length === 0) {
      console.log(`  ❌ 0 jobs extracted by Firecrawl for ${name}.`);
    } else {
      let passedLocation = 0;
      rawJobs.forEach((j, i) => {
        const isIndia = isIndianOrRemote(j.location);
        if (isIndia) passedLocation++;
        console.log(`   [${i + 1}] "${j.title}" | Loc: "${j.location}" | Passes India filter: ${isIndia}`);
      });
      console.log(`  Summary: ${rawJobs.length} raw → ${passedLocation} passed location filter.`);
    }
  } catch (err: any) {
    console.error(`  ❌ Scrape Error for ${name}:`, err.message);
  }
}

async function main() {
  await debugCompany("Microsoft", "https://jobs.careers.microsoft.com/global/en/search?lc=India");
  await debugCompany("Google", "https://careers.google.com/jobs/results/?location=India");
  await debugCompany("Amazon", "https://www.amazon.jobs/en/search?loc_query=India");
  process.exit(0);
}

main();

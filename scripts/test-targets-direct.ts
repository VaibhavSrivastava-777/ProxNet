import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { customStrategy } from "../lib/scrape-strategies";

async function testTargetCompanies() {
  console.log("--- TESTING DELL SCRAPER ---");
  try {
    const dellJobs = await customStrategy("https://jobs.dell.com/", "Dell");
    console.log(`Dell jobs returned: ${dellJobs.length}`);
    if (dellJobs.length > 0) {
      console.log("Sample Dell job:", dellJobs[0]);
    }
  } catch (err: any) {
    console.error("Dell scrape error:", err);
  }

  console.log("\n--- TESTING LENOVO SCRAPER ---");
  try {
    const lenovoJobs = await customStrategy("https://jobs.lenovo.com/", "Lenovo");
    console.log(`Lenovo jobs returned: ${lenovoJobs.length}`);
    if (lenovoJobs.length > 0) {
      console.log("Sample Lenovo job:", lenovoJobs[0]);
    }
  } catch (err: any) {
    console.error("Lenovo scrape error:", err);
  }
}

testTargetCompanies().catch(console.error);

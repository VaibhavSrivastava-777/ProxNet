import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { oracleStrategy, customStrategy } from "../lib/scrape-strategies";

async function testTargetFixes() {
  console.log("=== 1. TESTING DELL WITH ORACLE STRATEGY ===");
  const dellOracleUrl = "https://iawmqy.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/careers/requisitions";
  try {
    const dellJobs = await oracleStrategy(dellOracleUrl, "Dell");
    console.log(`Dell Oracle Jobs returned: ${dellJobs.length}`);
    if (dellJobs.length > 0) {
      console.log("Sample Dell Job:", dellJobs[0]);
    }
  } catch (e: any) {
    console.error("Dell Oracle error:", e.message);
  }

  console.log("\n=== 2. TESTING LENOVO WITH SEARCHJOBS URL ===");
  const lenovoSearchUrl = "https://jobs.lenovo.com/en_US/careers/SearchJobs/?jobRecordsPerPage=20";
  try {
    const lenovoJobs = await customStrategy(lenovoSearchUrl, "Lenovo");
    console.log(`Lenovo SearchJobs returned: ${lenovoJobs.length}`);
    if (lenovoJobs.length > 0) {
      console.log("Sample Lenovo Job:", lenovoJobs[0]);
    }
  } catch (e: any) {
    console.error("Lenovo SearchJobs error:", e.message);
  }
}

testTargetFixes().catch(console.error);

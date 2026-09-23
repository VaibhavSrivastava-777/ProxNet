import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { customStrategy } from "../lib/scrape-strategies";

async function testLenovoIndia() {
  const url1 = "https://jobs.lenovo.com/en_US/careers/SearchJobs/India";
  const url2 = "https://jobs.lenovo.com/en_US/careers/SearchJobs/?country=India";
  
  console.log("Testing Lenovo India URL 1...");
  try {
    const jobs = await customStrategy(url1, "Lenovo");
    console.log(`URL 1 returned ${jobs.length} jobs:`);
    jobs.slice(0, 3).forEach(j => console.log(" -", j.title, "|", j.location, "|", j.url));
  } catch (e: any) {
    console.log("URL 1 failed:", e.message);
  }
}

testLenovoIndia().catch(console.error);

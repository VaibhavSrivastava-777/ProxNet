import { workdayStrategy } from "./lib/scrape-strategies";

async function testWorkday() {
  try {
    const jobs = await workdayStrategy("lseglondonstockexchangegroup.wd3.myworkdayjobs.com/wday/cxs/lseglondonstockexchangegroup/LseglondonstockexchangegroupCareers/jobs", "LSEG");
    console.log(`Scraped ${jobs.length} jobs.`);
  } catch(e: any) {
    console.error(`Error:`, e.message);
  }
}

testWorkday();

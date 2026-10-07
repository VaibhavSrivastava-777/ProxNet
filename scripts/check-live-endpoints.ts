async function check(name: string, url: string) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      const count = Array.isArray(data) ? data.length : (data.jobs?.length || data.content?.length || 0);
      console.log(`✅ [${res.status}] ${name}: ${count} postings`);
    } else {
      console.log(`❌ [${res.status}] ${name}`);
    }
  } catch (e: any) {
    console.log(`⚠️ ${name}: ${e.message}`);
  }
}

async function main() {
  await check("Postman (GH)", "https://boards-api.greenhouse.io/v1/boards/postman/jobs");
  await check("S&P Global (GH)", "https://boards-api.greenhouse.io/v1/boards/spcareers/jobs");
  await check("Lead School (Lever)", "https://api.lever.co/v0/postings/lead?mode=json");
  await check("Swiggy (SR)", "https://api.smartrecruiters.com/v1/companies/swiggy/postings");
  await check("Freshworks (SR)", "https://api.smartrecruiters.com/v1/companies/freshworks/postings");
  await check("Scale AI (GH)", "https://boards-api.greenhouse.io/v1/boards/scaleai/jobs");
  await check("Together AI (GH)", "https://boards-api.greenhouse.io/v1/boards/togetherai/jobs");
  await check("Palantir (Lever)", "https://api.lever.co/v0/postings/palantir?mode=json");
  await check("Notion (Ashby)", "https://api.ashbyhq.com/posting-api/job-board/notion");
  await check("Slice (GH)", "https://boards-api.greenhouse.io/v1/boards/slice/jobs");
  await check("HubSpot (GH)", "https://boards-api.greenhouse.io/v1/boards/hubspotjobs/jobs");
  await check("Uber (SR)", "https://api.smartrecruiters.com/v1/companies/uber/postings");
  await check("InMobi (GH)", "https://boards-api.greenhouse.io/v1/boards/inmobi/jobs");
}

main();

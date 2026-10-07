async function test(name: string, url: string) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (res.ok) {
      const data = await res.json();
      const count = Array.isArray(data) ? data.length : (data.jobs?.length || data.content?.length || 0);
      console.log(`✅ ${name}: ${count} jobs`);
      return true;
    } else {
      console.log(`❌ ${name}: ${res.status}`);
    }
  } catch (e: any) {
    console.log(`⚠️ ${name}: ${e.message}`);
  }
  return false;
}

async function main() {
  await test("Rippling (Ashby)", "https://api.ashbyhq.com/posting-api/job-board/rippling");
  await test("Rippling (Lever)", "https://api.lever.co/v0/postings/rippling?mode=json");
  await test("Atlassian (Ashby)", "https://api.ashbyhq.com/posting-api/job-board/atlassian");
  await test("Atlassian (Lever)", "https://api.lever.co/v0/postings/atlassian?mode=json");
  await test("HashiCorp (Lever)", "https://api.lever.co/v0/postings/hashicorp?mode=json");
  await test("Zoho (Workable)", "https://www.workable.com/api/accounts/zoho?details=false");
  await test("Razorpay (Ashby)", "https://api.ashbyhq.com/posting-api/job-board/razorpay");
  await test("CRED (Ashby)", "https://api.ashbyhq.com/posting-api/job-board/cred");
  await test("CRED (Lever)", "https://api.lever.co/v0/postings/cred?mode=json");
}

main();

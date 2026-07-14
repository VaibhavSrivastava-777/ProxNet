async function test() {
  const url = "https://eggh.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCandidateExperienceJobPostings?limit=5";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });
    console.log(`Status: ${res.status}`);
    if (res.status === 200) {
      const body: any = await res.json();
      console.log(`Total jobs returned: ${body.items ? body.items.length : 0}`);
      if (body.items && body.items.length > 0) {
        console.log("First job title:", body.items[0].Title);
        console.log("First job location:", body.items[0].PrimaryLocation);
        console.log("First job Id:", body.items[0].Id);
      }
    }
  } catch (e: any) {
    console.error(e);
  }
}
test();

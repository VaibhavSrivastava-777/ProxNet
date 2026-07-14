async function check() {
  const url = "https://nonexistent-subdomain-123456789.wd3.myworkdayjobs.com/wday/cxs/nonexistent/Careers/jobs";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      body: JSON.stringify({
        appliedFacets: {},
        limit: 1,
        offset: 0,
        searchText: ""
      })
    });
    console.log(`Status for nonexistent: ${res.status}`);
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
  }
}
check();

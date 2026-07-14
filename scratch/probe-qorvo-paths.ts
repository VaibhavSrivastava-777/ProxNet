async function checkPath(site: string) {
  const url = `https://qorvo.wd1.myworkdayjobs.com/wday/cxs/qorvo/${site}/jobs`;
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
    if (res.status === 200) {
      const body = await res.json();
      console.log(`  🎉 Found working site path: "${site}" (${body.total} jobs)`);
      return true;
    }
  } catch (e) {}
  return false;
}

async function main() {
  const sites = [
    "Qorvo", "qorvo", "QorvoCareers", "Qorvo_Careers", "QorvoJobs", "Qorvo_Jobs", 
    "External", "external", "QorvoExternal", "Qorvo_External", "Careers", "careers", 
    "Jobs", "jobs", "Qorvo_External_Careers"
  ];
  for (const site of sites) {
    const found = await checkPath(site);
    if (found) break;
  }
}
main();

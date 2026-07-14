async function probeSharedWorkday(tenant: string, site: string): Promise<boolean> {
  const url = `https://www.myworkdayjobs.com/wday/cxs/${tenant.toLowerCase()}/${site}/jobs`;
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
      if (body && (body.jobPostings || body.total !== undefined)) {
        console.log(`  🎉 Found: ${url} -> ${body.total || (body.jobPostings ? body.jobPostings.length : 0)} jobs`);
        return true;
      }
    }
  } catch (e) {}
  return false;
}

async function main() {
  const tenants = ["Cognizant", "MediaTek", "Rakuten", "Optum", "EY", "IBM", "McKinsey", "Persistent"];
  const sites = ["Careers", "careers", "Jobs", "jobs", "External", "external", "Cognizant"];

  for (const tenant of tenants) {
    console.log(`Probing shared Workday for ${tenant}...`);
    for (const site of sites) {
      const found = await probeSharedWorkday(tenant, site);
      if (found) break;
    }
  }
}

main();

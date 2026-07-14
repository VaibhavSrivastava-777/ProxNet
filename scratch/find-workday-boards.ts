import * as nativeHttps from "https";

const wdSubdomains = [
  "myworkdayjobs.com", 
  "wd3.myworkdayjobs.com", 
  "wd1.myworkdayjobs.com", 
  "wd5.myworkdayjobs.com", 
  "wd103.myworkdayjobs.com", 
  "wd101.myworkdayjobs.com",
  "wd9.myworkdayjobs.com"
];

function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    fetch(url, { ...options, signal: controller.signal })
      .then(res => {
        clearTimeout(id);
        resolve(res);
      })
      .catch(err => {
        clearTimeout(id);
        reject(err);
      });
  });
}

async function probeWorkday(tenant: string): Promise<string | null> {
  const cleanTenant = tenant.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  
  // Site variants to test
  const siteVariants = [
    `${tenant}Careers`,
    `${tenant}Jobs`,
    `${cleanTenant}Careers`,
    `${cleanTenant}Jobs`,
    `careers`,
    `Careers`,
    tenant,
    cleanTenant
  ];

  // Unique site variants
  const uniqueSites = Array.from(new Set(siteVariants));

  for (const subdomain of wdSubdomains) {
    for (const site of uniqueSites) {
      const url = `https://${cleanTenant}.${subdomain}/wday/cxs/${cleanTenant}/${site}/jobs`;
      try {
        const res: any = await fetchWithTimeout(url, {
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
        }, 3000);

        if (res.status === 200) {
          const body = await res.json();
          if (body && (body.jobPostings || body.total !== undefined)) {
            console.log(`  🎉 Found working URL: ${url}`);
            return `${cleanTenant}.${subdomain}/wday/cxs/${cleanTenant}/${site}/jobs`;
          }
        }
      } catch (e) {}
    }
  }

  return null;
}

async function main() {
  const testCompanies = [
    "Diageo", "LSEG", "McKinsey", "Cognizant", "Persistent", 
    "Dell", "IBM", "EY", "Optum", "MediaTek", "Rakuten", 
    "Opentext", "Accenture"
  ];

  for (const company of testCompanies) {
    console.log(`Probing Workday for ${company}...`);
    const board = await probeWorkday(company);
    if (board) {
      console.log(`  ✅ Match: "${company}" -> "${board}"`);
    } else {
      console.log(`  ❌ No match found for "${company}"`);
    }
  }
}

main();

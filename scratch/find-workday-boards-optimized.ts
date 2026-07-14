import * as dns from "dns";
import { promisify } from "util";

const lookupAsync = promisify(dns.lookup);

const wdSubdomains = [
  "myworkdayjobs.com", 
  "wd3.myworkdayjobs.com", 
  "wd1.myworkdayjobs.com", 
  "wd5.myworkdayjobs.com", 
  "wd103.myworkdayjobs.com", 
  "wd101.myworkdayjobs.com",
  "wd9.myworkdayjobs.com"
];

async function checkDns(hostname: string): Promise<boolean> {
  try {
    await lookupAsync(hostname);
    return true;
  } catch (e) {
    return false;
  }
}

function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 4000): Promise<any> {
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

// Generate common site/path variants for a Workday board
function getSiteVariants(tenant: string): string[] {
  const tCapital = tenant.charAt(0).toUpperCase() + tenant.slice(1);
  return [
    `Careers`,
    `careers`,
    `Jobs`,
    `jobs`,
    `External`,
    `external`,
    `${tCapital}Careers`,
    `${tCapital}Jobs`,
    `${tenant}Careers`,
    `${tenant}Jobs`,
    `${tCapital}_Careers`,
    `${tCapital}_Jobs`,
    `${tenant}_Careers`,
    `${tenant}_Jobs`,
    `External_Careers`,
    `ExternalCareers`,
    `externalCareers`,
    `external_careers`,
    `External_Jobs`,
    `ExternalJobs`,
    `CompanyCareers`,
    `CompanyJobs`,
    `Workday`
  ];
}

async function probeWorkdayForTenant(tenant: string): Promise<string | null> {
  const cleanTenant = tenant.toLowerCase().trim();
  const siteVariants = Array.from(new Set(getSiteVariants(cleanTenant)));

  for (const subdomain of wdSubdomains) {
    const hostname = `${cleanTenant}.${subdomain}`;
    
    // DNS pre-check
    const resolves = await checkDns(hostname);
    if (!resolves) {
      continue;
    }

    console.log(`  🌐 Domain resolves: ${hostname}. Probing site paths...`);

    // Probe site paths in parallel groups
    const promises = siteVariants.map(async (site) => {
      const url = `https://${hostname}/wday/cxs/${cleanTenant}/${site}/jobs`;
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
        }, 4000);

        if (res.status === 200) {
          const body = await res.json();
          if (body && (body.jobPostings || body.total !== undefined)) {
            return url;
          }
        }
      } catch (e) {}
      return null;
    });

    const results = await Promise.all(promises);
    const found = results.find(r => r !== null);
    if (found) {
      return found;
    }
  }

  return null;
}

const companyTenants: Record<string, string[]> = {
  "LSEG (London Stock Exchange Group)": ["lseg"],
  "Dell Technologies": ["dell", "delltechnologies"],
  "Opentext": ["opentext"],
  "Foradian technologies Pvt Ltd": ["foradian", "foradiantechnologies"],
  "Hera": ["hera"],
  "Qorvo Semiconductor Private Limited": ["qorvo", "qorvosemiconductor"],
  "Verint systems Pvt Ltd": ["verint", "verintsystems"],
  "Accenture": ["accenture"],
  "Diageo": ["diageo"],
  "McKinsey and company": ["mckinsey"],
  "Coverself": ["coverself"],
  "Capita": ["capita"],
  "Fitsol": ["fitsol"],
  "ECGC LIMITED": ["ecgc", "ecgclimited"],
  "Cognizant Technology Solutions": ["cognizant", "cognizanttechnologysolutions"],
  "Persistent Systems": ["persistent", "persistentsystems"],
  "Farcast Biosciences": ["farcast", "farcastbiosciences"],
  "Optum": ["optum", "unitedhealth", "unitedhealthgroup"],
  "Rakuten India": ["rakuten", "rakutenindia"],
  "Applause": ["applause"],
  "IBM": ["ibm"],
  "EY": ["ey"],
  "Independent Advisory Practice": ["independentadvisorypractice"],
  "MediaTek": ["mediatek"],
  "Ujjivan Small Finance Bank": ["ujjivan", "ujjivansmallfinancebank"],
  "TNIFMC": ["tnifmc"],
  "ProxNet": ["proxnet"],
  "NPS HSR": ["nps", "npshsr"],
  "Retired": ["retired"],
  "ThirdAct Labs Private Limited": ["thirdact", "thirdactlabs"],
  "Kotak Mahindra Bank Ltd": ["kotak", "kotakmahindrabank"]
};

async function main() {
  const matches: Record<string, string> = {};

  for (const [company, tenants] of Object.entries(companyTenants)) {
    console.log(`\nProbing for "${company}"...`);
    let foundUrl: string | null = null;
    
    for (const tenant of tenants) {
      foundUrl = await probeWorkdayForTenant(tenant);
      if (foundUrl) {
        break;
      }
    }

    if (foundUrl) {
      console.log(`  ✅ FOUND: "${company}" -> ${foundUrl}`);
      matches[company] = foundUrl;
    } else {
      console.log(`  ❌ Not found in Workday.`);
    }
  }

  console.log("\n================ SUMMARY ================");
  console.log(JSON.stringify(matches, null, 2));
}

main();

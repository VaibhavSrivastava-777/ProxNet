import * as nativeHttps from "https";
import { ScrapedJob } from "./types";

export const stripHtml = (html: string): string => {
  if (!html) return "";
  let text = html.replace(/<[^>]*>?/gm, " ");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&rsquo;/g, "'");
  text = text.replace(/&lsquo;/g, "'");
  text = text.replace(/&rdquo;/g, '"');
  text = text.replace(/&ldquo;/g, '"');
  text = text.replace(/&ndash;/g, "-");
  text = text.replace(/&mdash;/g, "-");
  return text.replace(/\s+/g, " ").trim();
};

export const fetchWithHeaders = (url: string, options: any = {}) => {
  return fetch(url, {
    ...options,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ...options.headers,
    },
  });
};

export function postRequest(hostname: string, path: string, payload: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname,
      port: 443,
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    };
    const req = nativeHttps.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`POST ${path} failed with status ${res.statusCode}: ${body}`));
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

export function getRequest(hostname: string, path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port: 443,
      path,
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    };
    const req = nativeHttps.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`GET ${path} failed with status ${res.statusCode}: ${body}`));
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

export function isIndianOrIndianRemote(location: string): boolean {
  if (!location) return false;
  const loc = location.toLowerCase().trim();
  
  const indianKeywords = [
    "india", "bangalore", "bengaluru", "mumbai", "pune", "delhi", 
    "gurugram", "gurgaon", "noida", "hyderabad", "chennai", "kolkata",
    "kochi", "trivandrum", "thiruvananthapuram", "coimbatore", "chandigarh",
    "ahmedabad", "indore", "jaipur", "mysore", "mohali", "lucknow", "nagpur",
    "bhubaneswar", "visakhapatnam", "vadodara", "surat", "gandhinagar", "bhopal",
    "patna", "ludhiana", "thane", "navi mumbai",
    // States
    "maharashtra", "karnataka", "tamil nadu", "telangana", "andhra pradesh",
    "gujarat", "haryana", "uttar pradesh", "west bengal", "kerala", "punjab",
    "rajasthan", "madhya pradesh", "odisha", "orissa", "assam", "bihar",
    "jharkhand", "chhattisgarh"
  ];
  
  const hasIndianKeyword = indianKeywords.some(k => loc.includes(k)) || loc === "in" || loc === "ind" || loc.includes("pan india");
  
  if (loc.includes("remote")) {
    return hasIndianKeyword || loc === "remote"; // some ATS just say 'remote' and it defaults to India for Indian sites
  }
  
  return hasIndianKeyword;
}

export function generateSimulatedJobs(companyName: string, count: number = 2): ScrapedJob[] {
  const jobsList = [
    {
      title: "Senior Software Engineer",
      location: "Bengaluru, India",
      description: "We are looking for a Senior Software Engineer to join our core engineering team. You will design, develop, and maintain high-performance scalable web applications using TypeScript, React, Node.js, and cloud services. Requirements: 3+ years of experience in modern JavaScript frameworks, strong problem-solving skills, and experience with database design.",
      url: `https://careers.${companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com/jobs/senior-software-engineer`
    },
    {
      title: "Product Manager",
      location: "Remote, India",
      description: "We are seeking a Product Manager to drive product features from conception to launch. You will work closely with engineering, design, and marketing to define product requirements and roadmaps. Requirements: 3+ years of experience in product management, strong communication skills, and experience in agile development methodologies.",
      url: `https://careers.${companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com/jobs/product-manager`
    },
    {
      title: "Data Analyst",
      location: "Pune, India",
      description: "We are looking for a Data Analyst to transform data into business insights. You will build dashboards, analyze user behavior, and collaborate with team leads to optimize product operations. Requirements: 2+ years of experience with SQL, Python/R, and visualization tools like Tableau.",
      url: `https://careers.${companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com/jobs/data-analyst`
    }
  ];

  const results: ScrapedJob[] = [];
  for (let i = 0; i < Math.min(count, jobsList.length); i++) {
    results.push({
      ...jobsList[i],
      posted_at: new Date().toISOString(),
      source: "simulated"
    });
  }
  return results;
}

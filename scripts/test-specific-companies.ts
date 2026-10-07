async function checkATS(name: string, tokens: string[]) {
  for (const t of tokens) {
    // Greenhouse
    try {
      const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${t}/jobs?content=false`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.jobs && data.jobs.length > 0) {
          console.log(`[${name}] GREENHOUSE: ${t} (${data.jobs.length} jobs)`);
          return;
        }
      }
    } catch (e) {}

    // Lever
    try {
      const res = await fetch(`https://api.lever.co/v0/postings/${t}?mode=json`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          console.log(`[${name}] LEVER: ${t} (${data.length} jobs)`);
          return;
        }
      }
    } catch (e) {}

    // Ashby
    try {
      const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${t}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.jobs && data.jobs.length > 0) {
          console.log(`[${name}] ASHBY: ${t} (${data.jobs.length} jobs)`);
          return;
        }
      }
    } catch (e) {}

    // SmartRecruiters
    try {
      const res = await fetch(`https://api.smartrecruiters.com/v1/companies/${t}/postings`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.content && data.content.length > 0) {
          console.log(`[${name}] SMARTRECRUITERS: ${t} (${data.content.length} jobs)`);
          return;
        }
      }
    } catch (e) {}
  }
  console.log(`[${name}] No standard ATS found for tokens: ${tokens.join(", ")}`);
}

async function main() {
  const companies = [
    { name: "10x Genomics", tokens: ["10xgenomics", "10x", "10xgenomicsinc"] },
    { name: "Chargebee", tokens: ["chargebee", "chargebeeinc", "chargebee-technologies"] },
    { name: "Automattic", tokens: ["automattic", "automatticinc", "wordpress"] },
    { name: "Atlassian", tokens: ["atlassian", "atlassiancorp"] },
    { name: "Zoho", tokens: ["zoho", "zohocorp", "zohocorporation"] },
    { name: "Postman", tokens: ["postman", "getpostman"] },
    { name: "Freshworks", tokens: ["freshworks", "freshworksinc", "freshdesk"] },
    { name: "CleverTap", tokens: ["clevertap", "wizrocket"] },
    { name: "MoEngage", tokens: ["moengage", "moengageinc"] },
    { name: "Fractal", tokens: ["fractal", "fractalanalytics"] },
    { name: "BrowserStack", tokens: ["browserstack"] },
    { name: "Razorpay", tokens: ["razorpay", "razorpaysoftware"] },
    { name: "Swiggy", tokens: ["swiggy", "bundl"] },
    { name: "Zomato", tokens: ["zomato"] },
    { name: "Zepto", tokens: ["zepto", "kiranakart"] },
    { name: "Blinkit", tokens: ["blinkit", "grofers"] },
    { name: "Urban Company", tokens: ["urbancompany", "urbanclap"] },
    { name: "Lenskart", tokens: ["lenskart", "lenskartplus"] },
    { name: "PolicyBazaar", tokens: ["policybazaar", "pbfintech"] },
    { name: "Dunzo", tokens: ["dunzo"] },
    { name: "Delhivery", tokens: ["delhivery"] },
    { name: "InMobi", tokens: ["inmobi", "glance"] },
    { name: "Pine Labs", tokens: ["pinelabs", "pine-labs"] },
    { name: "CRED", tokens: ["cred", "dreamplug"] },
    { name: "PhonePe", tokens: ["phonepe", "fxmart"] },
    { name: "Meesho", tokens: ["meesho"] },
    { name: "Canva", tokens: ["canva"] },
    { name: "Check Point", tokens: ["checkpoint", "checkpointsoftwaretechnologies"] },
    { name: "Stripe", tokens: ["stripe"] },
    { name: "Figma", tokens: ["figma"] },
    { name: "Vercel", tokens: ["vercel"] },
    { name: "Datadog", tokens: ["datadog"] },
    { name: "Cloudflare", tokens: ["cloudflare"] },
    { name: "GitLab", tokens: ["gitlab"] },
    { name: "HashiCorp", tokens: ["hashicorp"] },
    { name: "MongoDB", tokens: ["mongodb"] },
    { name: "Elastic", tokens: ["elastic"] },
    { name: "Rippling", tokens: ["rippling"] },
  ];

  for (const c of companies) {
    await checkATS(c.name, c.tokens);
  }
}

main();

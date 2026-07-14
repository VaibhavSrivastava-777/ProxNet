function generateBoardVariants(companyName: string): string[] {
  const base = companyName.toLowerCase().trim();
  const stripped = base.replace(/[^a-z0-9]/g, "");
  const hyphenated = base.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const underscored = base.replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");

  const variants = new Set([
    stripped,
    hyphenated,
    underscored,
    stripped + "careers",
    stripped + "jobs",
    stripped + "hq",
    stripped + "inc",
    stripped + "io",
    stripped + "tech",
    hyphenated + "-careers",
  ]);

  return Array.from(variants);
}

async function fetchWithTimeout(url: string, timeoutMs = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function discoverAtsVerbose(companyName: string): Promise<{ provider: string; board: string } | null> {
  const variants = generateBoardVariants(companyName);
  console.log(`  Probing variants for "${companyName}": ${JSON.stringify(variants)}`);

  for (const guess of variants) {
    // 1. Lever
    const leverUrl = `https://api.lever.co/v0/postings/${guess}?mode=json`;
    try {
      const res = await fetchWithTimeout(leverUrl);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return { provider: "lever", board: guess };
        }
      }
    } catch (e: any) {}

    // 2. Greenhouse
    const ghUrl = `https://boards-api.greenhouse.io/v1/boards/${guess}/jobs?content=true`;
    try {
      const res = await fetchWithTimeout(ghUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && data.jobs && data.jobs.length > 0) {
          return { provider: "greenhouse", board: guess };
        }
      }
    } catch (e: any) {}

    // 3. Ashby
    const ashbyUrl = `https://api.ashbyhq.com/posting-api/job-board/${guess}`;
    try {
      const res = await fetchWithTimeout(ashbyUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && data.jobs && data.jobs.length > 0) {
          return { provider: "ashby", board: guess };
        }
      }
    } catch (e: any) {}

    // 4. SmartRecruiters
    const srUrl = `https://api.smartrecruiters.com/v1/companies/${guess}/postings`;
    try {
      const res = await fetchWithTimeout(srUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && data.content && data.content.length > 0) {
          return { provider: "smartrecruiters", board: guess };
        }
      }
    } catch (e: any) {}

    // 5. Workable
    const workableUrl = `https://www.workable.com/api/accounts/${guess}?details=true`;
    try {
      const res = await fetchWithTimeout(workableUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.jobs) && data.jobs.length > 0) {
          return { provider: "workable", board: guess };
        }
      }
    } catch (e: any) {}

    // 6. Breezy
    const breezyUrl = `https://${guess}.breezy.hr/json`;
    try {
      const res = await fetchWithTimeout(breezyUrl);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return { provider: "breezy", board: guess };
        }
      }
    } catch (e: any) {}

    // 7. Recruitee
    const recruiteeUrl = `https://${guess}.recruitee.com/api/offers`;
    try {
      const res = await fetchWithTimeout(recruiteeUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.offers) && data.offers.length > 0) {
          return { provider: "recruitee", board: guess };
        }
      }
    } catch (e: any) {}

    await new Promise(r => setTimeout(r, 100));
  }

  return null;
}

async function run() {
  const companies = [
    "Opentext",
    "Qorvo",
    "Applause",
    "Persistent",
    "McKinsey",
    "Capita",
    "MediaTek"
  ];

  for (const c of companies) {
    console.log(`🔎 Probing ATS for "${c}"...`);
    const res = await discoverAtsVerbose(c);
    if (res) {
      console.log(`✅ MATCH FOUND: Company="${c}", Provider="${res.provider}", Board="${res.board}"`);
    } else {
      console.log(`❌ NO ATS FOUND: Company="${c}"`);
    }
  }
}

run();

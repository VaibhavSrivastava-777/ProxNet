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

export async function discoverAts(companyName: string): Promise<{ provider: string; board: string } | null> {
  let guess = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
  
  if (guess === "notion") guess = "notionhq";
  if (guess === "ola") guess = "olacabs";

  // 1. Lever
  try {
    const leverRes = await fetchWithTimeout(`https://api.lever.co/v0/postings/${guess}?mode=json`);
    if (leverRes.ok) {
      const data = await leverRes.json();
      if (Array.isArray(data)) return { provider: "lever", board: guess };
    }
  } catch (e) {}

  // 2. Greenhouse
  try {
    const ghRes = await fetchWithTimeout(`https://boards-api.greenhouse.io/v1/boards/${guess}/jobs?content=true`);
    if (ghRes.ok) {
      const data = await ghRes.json();
      if (data && data.jobs) return { provider: "greenhouse", board: guess };
    }
  } catch (e) {}

  // 3. Ashby
  try {
    const ashbyRes = await fetchWithTimeout(`https://api.ashbyhq.com/posting-api/job-board/${guess}`);
    if (ashbyRes.ok) {
      const data = await ashbyRes.json();
      if (data && data.jobs) return { provider: "ashby", board: guess };
    }
  } catch (e) {}

  // 4. Workable
  try {
    const workableRes = await fetchWithTimeout(`https://www.workable.com/api/accounts/${guess}?details=true`);
    if (workableRes.ok) {
      const data = await workableRes.json();
      if (data && data.jobs) return { provider: "workable", board: guess };
    }
  } catch (e) {}

  // 5. Breezy
  try {
    const breezyRes = await fetchWithTimeout(`https://${guess}.breezy.hr/json`);
    if (breezyRes.ok) {
      const data = await breezyRes.json();
      if (Array.isArray(data)) return { provider: "breezy", board: guess };
    }
  } catch (e) {}

  // 6. Recruitee
  try {
    const recruiteeRes = await fetchWithTimeout(`https://${guess}.recruitee.com/api/offers`);
    if (recruiteeRes.ok) {
      const data = await recruiteeRes.json();
      if (data && data.offers) return { provider: "recruitee", board: guess };
    }
  } catch (e) {}

  // 7. SmartRecruiters
  try {
    const srRes = await fetchWithTimeout(`https://api.smartrecruiters.com/v1/companies/${guess}/postings`);
    if (srRes.ok) {
      const data = await srRes.json();
      if (data && data.content) return { provider: "smartrecruiters", board: guess };
    }
  } catch (e) {}

  return null;
}

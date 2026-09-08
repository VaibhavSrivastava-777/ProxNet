import { createAdminClient } from "../lib/supabase/admin";
import { discoverAts, KNOWN_BOARDS } from "../lib/ats-discovery";
import { STRATEGIES, customStrategy } from "../lib/scrape-strategies";

// Add specific known boards for enterprise & target companies if missing
const CUSTOM_BOARDS_MAP: Record<string, { provider: string; board: string }> = {
  "google": { provider: "custom", board: "https://careers.google.com/jobs/results/?location=India" },
  "microsoft": { provider: "custom", board: "https://jobs.careers.microsoft.com/global/en/search?lc=India" },
  "amazon": { provider: "amazon", board: "https://www.amazon.jobs/en/search?loc_query=India" },
  "lenovo": { provider: "custom", board: "https://jobs.lenovo.com/" },
  "accenture": { provider: "custom", board: "https://www.accenture.com/in-en/careers/jobsearch" },
  "applause": { provider: "workable", board: "https://apply.workable.com/applause/" },
  "capita": { provider: "custom", board: "https://www.capita.com/careers" },
  "cognizant technology solutions": { provider: "custom", board: "https://careers.cognizant.com/" },
  "coverself": { provider: "custom", board: "https://coverself.keka.com/careers" },
  "dell technologies": { provider: "custom", board: "https://jobs.dell.com/" },
  "diageo": { provider: "custom", board: "https://www.diageo.com/en/careers/search-and-apply" },
  "farcast biosciences": { provider: "custom", board: "https://www.farcastbio.com/careers" },
  "fitsol": { provider: "custom", board: "https://fitsol.greenhouse.io/" },
  "foradian technologies pvt ltd": { provider: "custom", board: "https://www.foradian.com/careers" },
  "hera": { provider: "ashby", board: "hellohera" },
  "huntsmen & barons": { provider: "smartrecruiters", board: "huntsmenbarons" },
  "infosys ltd.": { provider: "custom", board: "https://career.infosys.com/" },
  "infoveave pty ltd": { provider: "custom", board: "https://infoveave.com/careers" },
  "kotak mahindra bank ltd": { provider: "custom", board: "https://hcbt.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/requisitions" },
  "mckinsey and company": { provider: "custom", board: "https://www.mckinsey.com/careers/search-jobs" },
  "mediatek": { provider: "custom", board: "https://www.mediatek.com/careers" },
  "nec corporation": { provider: "custom", board: "https://in.nec.com/en_IN/careers/" },
  "opentext": { provider: "phenom", board: "https://careers.opentext.com/us/en/search-results" },
  "oracle": { provider: "custom", board: "https://careers.oracle.com/jobs/" },
  "rakuten india": { provider: "custom", board: "https://rakuten.careers/" },
  "thirdact labs private limited": { provider: "custom", board: "https://thirdactlabs.ai/careers" },
  "tnifmc": { provider: "custom", board: "https://tnifmc.com/careers" },
  "ujjivan small finance bank": { provider: "custom", board: "https://www.ujjivansfb.in/careers" },
  "verint systems pvt ltd": { provider: "custom", board: "https://www.verint.com/careers/" },
  "vodafone india services": { provider: "custom", board: "https://careers.vodafone.com/" },
  "wellsfargo": { provider: "custom", board: "https://www.wellsfargo.com/about/careers/" },
};

async function main() {
  const supabase = createAdminClient();
  const openaiKey = process.env.OPENAI_API_KEY;

  // 1. Target companies
  const { data: targetUser } = await supabase
    .from('users')
    .select('id, profile_digest')
    .eq('id', '50ecc4a2-c514-4922-8eb7-7e74961c7c4f')
    .single();

  const targetComps: string[] = (targetUser?.profile_digest?.target_companies || []).map((c: string) => c.trim());

  // 2. ProxNet network companies
  const { data: allUsers } = await supabase.from('users').select('company').not('company', 'is', null);
  const proxnetComps = Array.from(new Set((allUsers || []).map((u: any) => u.company ? u.company.trim() : null).filter(Boolean)));

  const invalidStrings = ['retired', 'independent advisory practice', 'student', 'freelance', 'self-employed', 'n/a', 'none'];
  const cleanProxnetComps = proxnetComps.filter(c => !invalidStrings.some(i => c.toLowerCase().includes(i)));

  // Combine unique map
  const compMap = new Map<string, { name: string; isTarget: boolean; isProxnet: boolean }>();
  targetComps.forEach(c => compMap.set(c.toLowerCase(), { name: c, isTarget: true, isProxnet: false }));
  cleanProxnetComps.forEach(c => {
    const key = c.toLowerCase();
    if (compMap.has(key)) {
      compMap.get(key)!.isProxnet = true;
    } else {
      compMap.set(key, { name: c, isTarget: false, isProxnet: true });
    }
  });

  // Check current job counts
  const { data: jobs } = await supabase.from('scraped_jobs').select('company');
  const jobCounts: Record<string, number> = {};
  (jobs || []).forEach((j: any) => {
    if (!j.company) return;
    jobCounts[j.company.trim().toLowerCase()] = (jobCounts[j.company.trim().toLowerCase()] || 0) + 1;
  });

  const zeroListingCompanies = Array.from(compMap.values()).filter(c => (jobCounts[c.name.toLowerCase()] || 0) === 0);

  console.log(`================================================================================`);
  console.log(`🔍 UNFILTERED SCRAPER INVESTIGATION FOR ${zeroListingCompanies.length} COMPANIES WITH 0 LISTINGS`);
  console.log(`================================================================================\n`);

  const results: any[] = [];

  for (let i = 0; i < zeroListingCompanies.length; i++) {
    const comp = zeroListingCompanies[i];
    const key = comp.name.toLowerCase();
    console.log(`[${i + 1}/${zeroListingCompanies.length}] 🧪 Testing Unfiltered Scraper for "${comp.name}"...`);

    // 1. Discover ATS configuration
    let provider = "custom";
    let boardUrl = `https://careers.google.com/jobs/results/?q=${encodeURIComponent(comp.name)}`;

    const customBoard = CUSTOM_BOARDS_MAP[key];
    if (customBoard) {
      provider = customBoard.provider;
      boardUrl = customBoard.board;
    } else {
      const discovered = await discoverAts(comp.name);
      if (discovered) {
        provider = discovered.provider;
        boardUrl = discovered.board;
      }
    }

    console.log(`  ℹ️ Resolved ATS: ${provider} | Board/URL: ${boardUrl}`);

    const strategy = STRATEGIES[provider] || customStrategy;

    let rawJobs: any[] = [];
    let errorMsg: string | null = null;

    try {
      rawJobs = await strategy(boardUrl, comp.name);
      console.log(`  🎉 Scraper pulled ${rawJobs.length} raw listings (UNFILTERED).`);
    } catch (err: any) {
      errorMsg = err.message || "Scrape failed";
      console.error(`  ❌ Scraper Error: ${errorMsg}`);
    }

    let savedCount = 0;
    let sampleJobStr = "—";

    if (rawJobs.length > 0) {
      const sample = rawJobs[0];
      sampleJobStr = `"${sample.title}" (${sample.location || "Remote"})`;
      console.log(`  Sample Job: ${sampleJobStr}`);

      // Save raw jobs to DB without any filters
      for (const j of rawJobs) {
        if (!j.title || j.title.trim().length < 3) continue;

        let embedding = null;
        if (openaiKey) {
          try {
            const textToEmbed = `Company: ${comp.name}\nTitle: ${j.title}\nLocation: ${j.location || "Remote"}\nDescription: ${(j.description || j.title).slice(0, 1000)}`;
            const oaiRes = await fetch("https://api.openai.com/v1/embeddings", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${openaiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                input: textToEmbed,
                model: "text-embedding-3-small",
              }),
            });
            if (oaiRes.ok) {
              const oaiData = await oaiRes.json();
              embedding = oaiData.data[0]?.embedding || null;
            }
          } catch (e) {}
        }

        const jobUrl = (j.url && j.url.startsWith("http") && j.url !== boardUrl)
          ? j.url
          : `${boardUrl}#${encodeURIComponent(j.title.replace(/\s+/g, '-'))}-${Math.random().toString(36).substring(2, 7)}`;

        const { error: insertErr } = await supabase.from("scraped_jobs").upsert({
          company: comp.name,
          title: j.title,
          location: j.location || "Remote",
          url: jobUrl,
          posted_at: j.posted_at || new Date().toISOString(),
          description: j.description || j.title,
          embedding,
          created_at: new Date().toISOString(),
        }, { onConflict: "url" });

        if (insertErr) {
          console.error(`    ⚠️ Insert Error for "${j.title}":`, insertErr.message);
        } else {
          savedCount++;
        }
      }

      await supabase.from("company_ats_config").upsert({
        company_name: comp.name,
        provider,
        board_token_or_url: boardUrl,
        total_jobs_found: rawJobs.length,
        scrape_status: "success",
        last_scraped_at: new Date().toISOString(),
      }, { onConflict: "company_name" });

      console.log(`  💾 Saved ${savedCount} listings into scraped_jobs table.`);
    } else {
      await supabase.from("company_ats_config").upsert({
        company_name: comp.name,
        provider,
        board_token_or_url: boardUrl,
        total_jobs_found: 0,
        scrape_status: errorMsg ? "failed" : "no_ats",
        scrape_notes: errorMsg || "0 raw jobs found",
        last_scraped_at: new Date().toISOString(),
      }, { onConflict: "company_name" });
    }

    results.push({
      company: comp.name,
      isTarget: comp.isTarget,
      provider,
      rawPulled: rawJobs.length,
      saved: savedCount,
      sampleJob: sampleJobStr,
      error: errorMsg,
    });

    console.log(`--------------------------------------------------------------------------------`);
  }

  console.log(`\n================================================================================`);
  console.log(`📊 FINAL UNFILTERED SCRAPER INVESTIGATION REPORT`);
  console.log(`================================================================================`);
  console.table(results.map(r => ({
    Company: r.company,
    "Target?": r.isTarget ? "Yes" : "No",
    Provider: r.provider,
    "Raw Jobs": r.rawPulled,
    "Saved DB": r.saved,
    "Sample Job": r.sampleJob,
  })));

  const successful = results.filter(r => r.rawPulled > 0);
  console.log(`\n🎉 SUMMARY: ${successful.length}/${results.length} companies successfully scraped at least 1 raw listing!`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { STRATEGIES, stripHtml } from "@/lib/scrape-strategies";
import { isJobEligible, cleanJobTitle, normalizeJobTitle, normalizeJobUrl } from "@/lib/jobs/job-filters";
import { discoverCompetitorsForCompany } from "@/lib/competitors/discover-competitors";
import { deductWalletCredits } from "@/lib/wallet";
import { verifyJobUrlLive } from "@/lib/jobs/url-validator";

export const maxDuration = 60;

interface LiveScrapedItem {
  id?: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  posted_at: string;
  source: string;
  keywords?: string[];
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const requestedCredits = Math.min(25, Math.max(1, parseInt(body.credits || "1", 10)));

    const supabase = createAdminClient();

    // 1. Fetch user's latest resume, profile, embedding, and wallet balance
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, job_title, company, about, professional_bio, resume_text, profile_digest, wallet, embedding")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const resumeText = userData.resume_text?.trim() || "";
    if (resumeText.length < 50) {
      return NextResponse.json({
        error: "NO_RESUME",
        message: "Please upload your resume to run the Deep ATS Match Hunter.",
      }, { status: 400 });
    }

    const currentWallet = userData.wallet ?? 0;
    if (currentWallet < requestedCredits) {
      return NextResponse.json({
        error: "INSUFFICIENT_CREDITS",
        message: `You have ${currentWallet} credit(s), but requested ${requestedCredits}. Please earn or recharge credits.`,
        wallet: currentWallet,
      }, { status: 402 });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json({ error: "AI matching service is temporarily unavailable" }, { status: 503 });
    }

    // Helper to identify and strictly exclude the candidate's own current employer
    const userCompany = (userData.company || "").trim().toLowerCase();
    const cleanUserCompany = userCompany.replace(/\b(inc|llc|ltd|limited|corp|corporation|technologies|solutions|india|pvt|services)\b/gi, "").trim();

    const isSameCompany = (compName?: string | null): boolean => {
      if (!userCompany || !compName) return false;
      const c = compName.trim().toLowerCase();
      if (c === userCompany) return true;
      const cleanTarget = c.replace(/\b(inc|llc|ltd|limited|corp|corporation|technologies|solutions|india|pvt|services)\b/gi, "").trim();
      if (cleanUserCompany.length >= 3 && cleanTarget.length >= 3) {
        if (cleanUserCompany === cleanTarget || cleanUserCompany.startsWith(cleanTarget) || cleanTarget.startsWith(cleanUserCompany)) {
          return true;
        }
      }
      return false;
    };

    // 2. Fetch candidate's target companies & priority ATS configurations
    const { data: userTargetRows } = await supabase
      .from("user_target_companies")
      .select("company_name, ats_provider, ats_board_token, careers_url")
      .eq("user_id", user.id);

    const userTargetCompanyNames = new Set<string>();
    for (const r of userTargetRows || []) {
      if (r.company_name && !isSameCompany(r.company_name)) {
        userTargetCompanyNames.add(r.company_name.toLowerCase().trim());
      }
    }

    // Fetch high-yield ATS configurations (Greenhouse, Lever, Ashby, Workable, SmartRecruiters)
    const { data: atsConfigs } = await supabase
      .from("company_ats_config")
      .select("company_name, provider, board_token_or_url")
      .in("provider", ["greenhouse", "lever", "ashby", "workable", "smartrecruiters"])
      .limit(60);

    // Discover authentic industry competitors dynamically
    let discoveredCompetitorNames: string[] = [];
    if (userData.company) {
      try {
        const compRes = await discoverCompetitorsForCompany(userData.company);
        discoveredCompetitorNames = (compRes.competitors || [])
          .map(c => c.name.trim().toLowerCase())
          .filter(c => Boolean(c) && !isSameCompany(c));
      } catch (err: any) {
        console.warn("[deep-fetch] Competitor discovery warning:", err.message);
      }
    }

    // Prioritize user target companies + discovered competitor boards + general high-yield boards
    interface BoardTarget {
      company: string;
      provider: string;
      token: string;
    }

    const targetBoards: BoardTarget[] = [];
    const seenCompanies = new Set<string>();

    // 1. Add user target companies first (excluding own company)
    for (const r of userTargetRows || []) {
      const cKey = r.company_name.toLowerCase().trim();
      if (!isSameCompany(r.company_name) && !seenCompanies.has(cKey) && r.ats_provider && r.ats_board_token && r.ats_provider !== "none") {
        seenCompanies.add(cKey);
        targetBoards.push({
          company: r.company_name,
          provider: r.ats_provider,
          token: r.ats_board_token,
        });
      }
    }

    // 2. Add discovered competitor ATS boards next
    if (discoveredCompetitorNames.length > 0 && Array.isArray(atsConfigs)) {
      for (const cfg of atsConfigs) {
        const cKey = cfg.company_name.toLowerCase().trim();
        if (
          !isSameCompany(cfg.company_name) &&
          !seenCompanies.has(cKey) &&
          cfg.board_token_or_url &&
          discoveredCompetitorNames.some(comp => comp === cKey || comp.includes(cKey) || cKey.includes(comp))
        ) {
          seenCompanies.add(cKey);
          targetBoards.push({
            company: cfg.company_name,
            provider: cfg.provider,
            token: cfg.board_token_or_url,
          });
        }
        if (targetBoards.length >= 20) break;
      }
    }

    // 3. Add remaining high-yield ATS configs up to 25 boards
    for (const cfg of atsConfigs || []) {
      const cKey = cfg.company_name.toLowerCase().trim();
      if (!isSameCompany(cfg.company_name) && !seenCompanies.has(cKey) && cfg.board_token_or_url) {
        seenCompanies.add(cKey);
        targetBoards.push({
          company: cfg.company_name,
          provider: cfg.provider,
          token: cfg.board_token_or_url,
        });
      }
      if (targetBoards.length >= 25) break; // Limit to 25 boards for sub-3s parallel execution
    }

    // 3. LIVE INDEPENDENT ATS CRAWL: Query external ATS APIs concurrently
    const liveScrapedJobs: LiveScrapedItem[] = [];

    const crawlPromises = targetBoards.map(async (board) => {
      const strategy = STRATEGIES[board.provider];
      if (!strategy) return;

      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 4000)
        );
        const jobs = await Promise.race([
          strategy(board.token, board.company),
          timeoutPromise,
        ]);

        if (Array.isArray(jobs)) {
          for (const j of jobs) {
            const cleanTitle = cleanJobTitle(normalizeJobTitle(j.title));
            const eligibility = isJobEligible({
              title: cleanTitle,
              location: j.location,
              description: j.description,
              posted_at: j.posted_at,
            });

            if (eligibility.eligible) {
              liveScrapedJobs.push({
                title: cleanTitle,
                company: board.company,
                location: j.location || "Remote",
                url: normalizeJobUrl(j.url),
                description: stripHtml(j.description || cleanTitle),
                posted_at: j.posted_at || new Date().toISOString(),
                source: board.provider,
                keywords: j.keywords || [],
              });
            }
          }
        }
      } catch {
        // Individual ATS board network timeouts fail gracefully without stalling the crawl
      }
    });

    await Promise.allSettled(crawlPromises);

    // 4. Ingest newly discovered live jobs into `scraped_jobs` in background / batch
    if (liveScrapedJobs.length > 0) {
      const rowsToUpsert = liveScrapedJobs.slice(0, 100).map((j) => ({
        title: j.title,
        company: j.company,
        location: j.location,
        url: j.url,
        description: j.description,
        posted_at: j.posted_at,
        source: j.source,
        keywords: j.keywords || ["Live ATS Discovery"],
        is_active: true,
        updated_at: new Date().toISOString(),
      }));

      // Upsert to enrich database
      try {
        await supabase
          .from("scraped_jobs")
          .upsert(rowsToUpsert, { onConflict: "url", ignoreDuplicates: false });
      } catch (upsertErr) {
        console.error("[deep-fetch] Scraped jobs upsert warning:", upsertErr);
      }
    }

    // 5. Augment candidate pool with semantic vector search matches from database
    let vectorJobs: any[] = [];
    if (userData.embedding) {
      const { data: matchedJobs } = await supabase.rpc("match_scraped_jobs", {
        query_embedding: userData.embedding,
        match_threshold: 0.22,
        match_count: 80,
      });
      vectorJobs = matchedJobs || [];
    }

    // Combine live ATS scraped jobs and top vector matches
    const allCandidateJobs: LiveScrapedItem[] = [];
    const seenJobKeys = new Set<string>();

    // Add live jobs first (priority to fresh live ATS postings, excluding candidate's own company)
    for (const j of liveScrapedJobs) {
      if (isSameCompany(j.company)) continue;
      const key = `${j.company.toLowerCase().trim()}:::${j.title.toLowerCase().trim()}`;
      if (!seenJobKeys.has(key)) {
        seenJobKeys.add(key);
        allCandidateJobs.push(j);
      }
    }

    // Add vector jobs (excluding candidate's own company & enforcing region/freshness eligibility)
    for (const vj of vectorJobs) {
      if (isSameCompany(vj.company)) continue;
      const cleanTitle = cleanJobTitle(normalizeJobTitle(vj.title));

      const eligibility = isJobEligible({
        title: cleanTitle,
        location: vj.location,
        description: vj.description,
        posted_at: vj.posted_at,
      });
      if (!eligibility.eligible) continue;

      const key = `${(vj.company || "").toLowerCase().trim()}:::${cleanTitle.toLowerCase().trim()}`;
      if (!seenJobKeys.has(key)) {
        seenJobKeys.add(key);
        allCandidateJobs.push({
          id: vj.id,
          title: cleanTitle,
          company: vj.company,
          location: vj.location || "Remote",
          url: vj.url || "",
          description: vj.description || cleanTitle,
          posted_at: vj.posted_at || new Date().toISOString(),
          source: "vector_match",
          keywords: vj.keywords || [],
        });
      }
    }

    // If candidate pool is still sparse, fetch recent active scraped jobs (excluding candidate's own company & enforcing region/freshness eligibility)
    if (allCandidateJobs.length < 20) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: fallbackRecent } = await supabase
        .from("scraped_jobs")
        .select("id, title, company, location, url, description, posted_at, keywords")
        .eq("is_active", true)
        .gte("posted_at", thirtyDaysAgo.toISOString())
        .order("posted_at", { ascending: false })
        .limit(100);

      for (const fj of fallbackRecent || []) {
        if (isSameCompany(fj.company)) continue;
        const cleanTitle = cleanJobTitle(normalizeJobTitle(fj.title));

        const eligibility = isJobEligible({
          title: cleanTitle,
          location: fj.location,
          description: fj.description,
          posted_at: fj.posted_at,
        });
        if (!eligibility.eligible) continue;

        const key = `${(fj.company || "").toLowerCase().trim()}:::${cleanTitle.toLowerCase().trim()}`;
        if (!seenJobKeys.has(key)) {
          seenJobKeys.add(key);
          allCandidateJobs.push({
            id: fj.id,
            title: cleanTitle,
            company: fj.company,
            location: fj.location || "Remote",
            url: fj.url || "",
            description: fj.description || cleanTitle,
            posted_at: fj.posted_at || new Date().toISOString(),
            source: "recent_active",
            keywords: fj.keywords || [],
          });
        }
      }
    }

    // Pick diverse set across companies for AI evaluation (up to 35 jobs, max 2 per company)
    const companyCounts = new Map<string, number>();
    const evaluationBatch: LiveScrapedItem[] = [];

    for (const j of allCandidateJobs) {
      const cKey = j.company.toLowerCase().trim();
      const count = companyCounts.get(cKey) || 0;
      if (count < 2) {
        evaluationBatch.push(j);
        companyCounts.set(cKey, count + 1);
      }
      if (evaluationBatch.length >= 35) break;
    }

    // 6. BATCH AI RERANKING & EVALUATION (>70% FIT FILTER)
    const candidateContext = `
CANDIDATE RESUME & PROFILE:
- Title: ${userData.job_title || "Professional"}
- Company: ${userData.company || "Unknown"}
- Summary: ${userData.profile_digest?.summary || userData.about || "N/A"}
- Core Skills: ${(userData.profile_digest?.skills || []).join(", ") || "General"}
- Resume Excerpt:
${resumeText.slice(0, 3000)}
`.trim();

    interface EvaluatedMatch {
      id?: string;
      title: string;
      company: string;
      location: string;
      url: string;
      description: string;
      posted_at: string;
      score: number;
      label: string;
      reason: string;
      source: string;
      isPioneer?: boolean;
      bountyCredits?: number;
      referralContacts?: Array<{ id: string; alias: string }>;
    }

    const verifiedMatches: EvaluatedMatch[] = [];

    // Evaluate in chunks of 8
    const CHUNK_SIZE = 8;
    for (let i = 0; i < evaluationBatch.length; i += CHUNK_SIZE) {
      const chunk = evaluationBatch.slice(i, i + CHUNK_SIZE);

      const jobsPayload = chunk.map((j, idx) => ({
        index: idx,
        title: j.title,
        company: j.company,
        location: j.location,
        descriptionSnippet: j.description.slice(0, 600).trim(),
      }));

      const systemPrompt = `You are an expert technical talent evaluator. Evaluate how strongly the candidate's resume and background match each job opening.
Score each job strictly from 0 to 100 based on functional discipline alignment, seniority, and domain relevance.
CRITICAL CRITERIA:
1. FUNCTIONAL DISCIPLINE (STRICT):
   - Completely different functional areas MUST receive LOW scores (< 40%).
   - Examples: Product Manager vs Software Engineer (< 35%), Sales vs Engineering (< 30%), Marketing vs DevOps (< 30%).
2. SENIORITY & DOMAIN:
   - Match candidate career level and industry domain (SaaS, FinTech, Cloud, AI, E-commerce).
3. SCORE SCALE:
   - 85-100: "Strong Match" (Direct alignment on role function, stack, domain)
   - 70-84: "Good Match" (Strong transferable fit in same functional area)
   - 50-69: "Moderate Match" (Partial overlap)
   - 0-49: "Low Match" (Discipline mismatch)

Output valid JSON ONLY with format:
{
  "evaluations": [
    {
      "index": 0,
      "score": 88,
      "reason": "1 clear, compelling sentence explaining the specific functional and domain fit."
    }
  ]
}`;

      try {
        const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.1,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `${candidateContext}\n\nEVALUATE THESE JOBS:\n${JSON.stringify(jobsPayload, null, 2)}` },
            ],
            response_format: { type: "json_object" },
          }),
          signal: AbortSignal.timeout(18000),
        });

        if (oaiRes.ok) {
          const oaiData = await oaiRes.json();
          const parsed = JSON.parse(oaiData.choices[0]?.message?.content || "{}");
          const evals = parsed.evaluations || [];

          for (const ev of evals) {
            const idx = typeof ev.index === "number" ? ev.index : -1;
            const targetJob = chunk[idx];
            if (!targetJob) continue;

            const score = typeof ev.score === "number" ? Math.min(100, Math.max(0, Math.round(ev.score))) : 30;
            // FILTER: STRICTLY SCORE >= 70
            if (score >= 70) {
              const label = score >= 85 ? "Strong Match" : "Good Match";
              const reason = ev.reason || "Strong functional alignment with candidate background.";

              verifiedMatches.push({
                id: targetJob.id || `live_${targetJob.company.toLowerCase().replace(/[^a-z0-9]/g, "")}_${cleanJobTitle(targetJob.title).toLowerCase().replace(/[^a-z0-9]/g, "")}`,
                title: targetJob.title,
                company: targetJob.company,
                location: targetJob.location,
                url: targetJob.url,
                description: targetJob.description,
                posted_at: targetJob.posted_at,
                score,
                label,
                reason,
                source: targetJob.source,
              });
            }
          }
        }
      } catch (chunkErr) {
        console.error("[deep-fetch] AI batch error:", chunkErr);
      }
    }

    // 7. Sort verified matches strictly in DESCENDING ORDER of score (excluding candidate's own current company & verifying region/date filters)
    const externalMatches = verifiedMatches.filter((m) => {
      if (!isSameCompany(m.company)) {
        const { eligible } = isJobEligible({
          title: m.title,
          location: m.location,
          description: m.description,
          posted_at: m.posted_at,
        });
        return eligible;
      }
      return false;
    });
    externalMatches.sort((a, b) => b.score - a.score);

    // 8. Real-time Live URL Verification: Prune 404s, 410s, and closed redirects
    const liveDeliveredMatches: EvaluatedMatch[] = [];
    const deadJobIds: string[] = [];
    const deliveredCompanies = new Set<string>();

    // Probe the top candidate matches concurrently (pool of up to requestedCredits + 8)
    const candidatesToProbe = externalMatches.slice(0, requestedCredits + 8);
    const probeResults = await Promise.allSettled(
      candidatesToProbe.map(async (m) => {
        const check = await verifyJobUrlLive(m.url, 2500);
        return { match: m, live: check.live, reason: check.reason };
      })
    );

    for (const res of probeResults) {
      if (res.status === "fulfilled") {
        if (res.value.live) {
          const cKey = res.value.match.company.toLowerCase().trim();
          if (!deliveredCompanies.has(cKey) && liveDeliveredMatches.length < requestedCredits) {
            deliveredCompanies.add(cKey);
            liveDeliveredMatches.push(res.value.match);
          }
        } else {
          console.warn(`[deep-fetch] Pruning 404/dead job: ${res.value.match.company} - ${res.value.match.title} (${res.value.match.url}) [${res.value.reason}]`);
          if (res.value.match.id && !res.value.match.id.startsWith("live_")) {
            deadJobIds.push(res.value.match.id);
          }
        }
      }
    }

    // If still need matches, backfill from remaining external matches (strictly distinct companies)
    if (liveDeliveredMatches.length < requestedCredits && externalMatches.length > candidatesToProbe.length) {
      for (const remaining of externalMatches.slice(candidatesToProbe.length)) {
        if (liveDeliveredMatches.length >= requestedCredits) break;
        const cKey = remaining.company.toLowerCase().trim();
        if (deliveredCompanies.has(cKey)) continue;

        const check = await verifyJobUrlLive(remaining.url, 2000);
        if (check.live) {
          deliveredCompanies.add(cKey);
          liveDeliveredMatches.push(remaining);
        } else if (remaining.id && !remaining.id.startsWith("live_")) {
          deadJobIds.push(remaining.id);
        }
      }
    }

    // Automatically deactivate confirmed 404/dead jobs in database (fire-and-forget)
    if (deadJobIds.length > 0) {
      (async () => {
        try {
          await supabase
            .from("scraped_jobs")
            .update({ is_active: false })
            .in("id", deadJobIds);
        } catch {
          // Non-critical: ignore deactivation errors
        }
      })();
    }

    const deliveredMatches = liveDeliveredMatches;
    const actualCharged = deliveredMatches.length;

    let updatedWallet = currentWallet;

    if (actualCharged > 0) {
      const deductRes = await deductWalletCredits(user.id, "deep_ats_fetch", undefined, actualCharged);
      updatedWallet = deductRes.newBalance;
    }

    // 9. Pioneer Bounty & Referral Contacts Enrichment
    const matchedCompanies = Array.from(new Set(deliveredMatches.map((m) => m.company.trim())));
    const companyMembersMap = new Map<string, Array<{ id: string; alias: string }>>();

    if (matchedCompanies.length > 0) {
      const { data: memberRows } = await supabase
        .from("users")
        .select("id, company, job_title")
        .eq("is_active", true)
        .neq("id", user.id)
        .not("company", "is", null);

      for (const m of memberRows || []) {
        if (!m.company) continue;
        const key = m.company.toLowerCase().trim();
        if (!companyMembersMap.has(key)) {
          companyMembersMap.set(key, []);
        }
        companyMembersMap.get(key)!.push({
          id: m.id,
          alias: m.job_title ? `${m.job_title} @ ${m.company}` : `Professional @ ${m.company}`,
        });
      }
    }

    for (const match of deliveredMatches) {
      const cKey = match.company.toLowerCase().trim();
      const members = companyMembersMap.get(cKey) || [];
      if (members.length > 0) {
        match.isPioneer = false;
        match.referralContacts = members;
      } else {
        match.isPioneer = true;
        match.bountyCredits = 10;
        match.referralContacts = [];
      }
    }

    // 10. Persist evaluated matches to candidate profile_digest.evaluated_matches
    const currentProfileDigest = userData.profile_digest || {};
    const existingEvaluated = currentProfileDigest.evaluated_matches || {};
    for (const m of deliveredMatches) {
      const storeId = m.id || m.url;
      existingEvaluated[storeId] = {
        jobId: storeId,
        score: m.score,
        label: m.label,
        reason: m.reason,
        evaluated_at: new Date().toISOString(),
      };
    }

    await supabase
      .from("users")
      .update({
        profile_digest: {
          ...currentProfileDigest,
          evaluated_matches: existingEvaluated,
        },
      })
      .eq("id", user.id);

    return NextResponse.json({
      success: true,
      matches: deliveredMatches,
      totalFound: verifiedMatches.length,
      creditsRequested: requestedCredits,
      creditsExpended: actualCharged,
      remainingWallet: updatedWallet,
      message: actualCharged > 0
        ? `Found ${actualCharged} verified high-fit opportunities (>70% match) from live ATS boards!`
        : "No live openings reached the strict 70% threshold. Zero credits were deducted.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[/api/jobs/deep-fetch] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

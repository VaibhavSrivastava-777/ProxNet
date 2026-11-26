import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export interface DiscoverJobItem {
  id: string;
  role: string;
  company: string;
  skills: string;
  created_at: string;
  url?: string;
  description?: string;
  isCompetitor?: boolean;
}

export interface CompanyJobBundle {
  company: string;
  exactJobs: DiscoverJobItem[];
  competitorJobs: DiscoverJobItem[];
  competitorNames: string[];
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  try {
    // 1. Fetch competitors mappings
    const { data: competitorRows, error: compErr } = await supabase
      .from("company_competitors")
      .select("company_name, competitor_name")
      .eq("is_active", true);

    if (compErr) {
      console.warn("[discover-company-jobs] Competitor fetch error:", compErr);
    }

    // Build competitor relationship map (both ways or from company -> competitors)
    const companyToCompetitors = new Map<string, Set<string>>();
    for (const row of competitorRows || []) {
      const cName = row.company_name?.trim().toLowerCase();
      const compName = row.competitor_name?.trim();
      if (!cName || !compName) continue;

      if (!companyToCompetitors.has(cName)) {
        companyToCompetitors.set(cName, new Set());
      }
      companyToCompetitors.get(cName)!.add(compName);
    }

    // 2. Fetch scraped jobs (latest 1000)
    const { data: scrapedJobs, error: jobsErr } = await supabase
      .from("scraped_jobs")
      .select("id, title, company, location, keywords, url, description, created_at, posted_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (jobsErr) {
      console.error("[discover-company-jobs] Jobs fetch error:", jobsErr);
      return NextResponse.json({ error: jobsErr.message }, { status: 500 });
    }

    // Group jobs by company key
    const allJobsByCompany = new Map<string, DiscoverJobItem[]>();
    for (const job of scrapedJobs || []) {
      const rawComp = (job.company || "").trim();
      if (!rawComp) continue;
      const key = rawComp.toLowerCase();

      const jobItem: DiscoverJobItem = {
        id: job.id,
        role: job.title || "Job Opening",
        company: rawComp,
        skills: job.keywords || job.location || "",
        created_at: job.created_at || job.posted_at || new Date().toISOString(),
        url: job.url,
        description: job.description || "",
      };

      if (!allJobsByCompany.has(key)) {
        allJobsByCompany.set(key, []);
      }
      allJobsByCompany.get(key)!.push(jobItem);
    }

    // 3. Construct bundled response for all companies present in jobs or competitors
    const bundles: Record<string, CompanyJobBundle> = {};

    // Helper to get or init bundle
    const getBundle = (companyRaw: string) => {
      const key = companyRaw.trim().toLowerCase();
      if (!bundles[key]) {
        bundles[key] = {
          company: companyRaw.trim(),
          exactJobs: [],
          competitorJobs: [],
          competitorNames: [],
        };
      }
      return bundles[key];
    };

    // Populate exact jobs
    for (const [key, jobs] of allJobsByCompany.entries()) {
      if (jobs.length > 0) {
        const bundle = getBundle(jobs[0].company);
        bundle.exactJobs = jobs.map((j) => ({ ...j, isCompetitor: false }));
      }
    }

    // Populate competitor jobs and competitor names
    for (const [compKey, competitorsSet] of companyToCompetitors.entries()) {
      const bundle = getBundle(compKey);
      bundle.competitorNames = Array.from(competitorsSet);

      const competitorJobs: DiscoverJobItem[] = [];
      for (const competitorName of competitorsSet) {
        const competitorKey = competitorName.toLowerCase();
        const compJobs = allJobsByCompany.get(competitorKey) || [];
        for (const cj of compJobs) {
          competitorJobs.push({
            ...cj,
            isCompetitor: true,
          });
        }
      }
      bundle.competitorJobs = competitorJobs;
    }

    return NextResponse.json({
      bundles,
      totalJobs: (scrapedJobs || []).length,
    });
  } catch (err: any) {
    console.error("[discover-company-jobs] Unexpected error:", err);
    return NextResponse.json({ error: err.message || "Failed to load jobs" }, { status: 500 });
  }
}

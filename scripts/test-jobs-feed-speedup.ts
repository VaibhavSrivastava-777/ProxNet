import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createAdminClient } from '../lib/supabase/admin';

let cachedCompanies: any = null;
let lastCachedAt = 0;
const CACHE_TTL_MS = 3 * 60 * 1000;

async function getOptimizedJobsAll(userId: string) {
  const t0 = performance.now();
  const supabase = createAdminClient();

  // If cache is expired or missing, refresh jobs in parallel
  if (!cachedCompanies || Date.now() - lastCachedAt > CACHE_TTL_MS) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysIso = thirtyDaysAgo.toISOString();

    const batchRanges = [[0, 999], [1000, 1999], [2000, 2999], [3000, 3999], [4000, 4999], [5000, 5999], [6000, 6999]];

    const [
      b0, b1, b2, b3, b4, b5, b6,
      usersRes
    ] = await Promise.all([
      ...batchRanges.map(([s, e]) =>
        supabase
          .from('scraped_jobs')
          .select('id, company, title, location, url, description, posted_at, keywords')
          .gte('posted_at', thirtyDaysIso)
          .order('posted_at', { ascending: false })
          .range(s, e)
      ),
      supabase
        .from('users')
        .select('id, company, job_title')
        .eq('is_blocked', false)
        .not('company', 'is', null),
    ]);

    const allJobs = [
      ...(b0.data || []),
      ...(b1.data || []),
      ...(b2.data || []),
      ...(b3.data || []),
      ...(b4.data || []),
      ...(b5.data || []),
      ...(b6.data || []),
    ];

    // Build base company groups
    const companyReferrers = new Map<string, Array<{ id: string; alias: string }>>();
    for (const u of usersRes.data || []) {
      if (u.company && u.company.trim()) {
        const cKey = u.company.trim().toLowerCase();
        if (!companyReferrers.has(cKey)) companyReferrers.set(cKey, []);
        companyReferrers.get(cKey)!.push({
          id: u.id,
          alias: u.job_title ? `${u.job_title} @ ${u.company}` : `Professional @ ${u.company}`,
        });
      }
    }

    const companiesMap = new Map<string, any>();
    for (const job of allJobs) {
      const rawCompany = (job.company || 'Hiring Company').trim();
      if (!rawCompany) continue;
      const compKey = rawCompany.toLowerCase();

      if (!companiesMap.has(compKey)) {
        const referrers = companyReferrers.get(compKey) || [];
        companiesMap.set(compKey, {
          company: rawCompany,
          contactsCount: referrers.length,
          referralContacts: referrers,
          jobs: [],
        });
      }

      const compData = companiesMap.get(compKey)!;
      if (!compData.jobs.some((j: any) => j.id === job.id)) {
        compData.jobs.push({
          id: job.id,
          title: job.title || 'Job Opening',
          location: job.location || 'Remote / India',
          url: job.url || '',
          description: job.description || '',
          posted_at: job.posted_at || new Date().toISOString(),
          keywords: job.keywords || [],
        });
      }
    }

    cachedCompanies = Array.from(companiesMap.values()).sort((a, b) => b.jobs.length - a.jobs.length);
    lastCachedAt = Date.now();
  }

  // User-specific fetch (profile + followed)
  const [userProfileRes, followsRes] = await Promise.all([
    supabase
      .from('users')
      .select('resume_text, resume_url, wallet, company, invite_code')
      .eq('id', userId)
      .single(),
    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId),
  ]);

  const followedSet = new Set(followsRes.data?.map(f => f.following_id) || []);

  // Personalize followed flag on company referral contacts
  const personalizedCompanies = cachedCompanies.map((c: any) => ({
    ...c,
    referralContacts: c.referralContacts.map((rc: any) => ({
      ...rc,
      is_followed: followedSet.has(rc.id),
    })),
  }));

  const t1 = performance.now();
  return {
    durationMs: t1 - t0,
    companiesCount: personalizedCompanies.length,
    wallet: userProfileRes.data?.wallet ?? 0,
  };
}

async function main() {
  const supabase = createAdminClient();
  const testUser = (await supabase.from('users').select('id').limit(1).single()).data?.id;

  console.log('--- CALL 1: Cache Miss (Parallel DB fetch) ---');
  const res1 = await getOptimizedJobsAll(testUser);
  console.log(`Call 1 completed in: ${res1.durationMs.toFixed(1)}ms | Companies: ${res1.companiesCount}`);

  console.log('\n--- CALL 2: Cache Hit (Instant in-memory) ---');
  const res2 = await getOptimizedJobsAll(testUser);
  console.log(`Call 2 completed in: ${res2.durationMs.toFixed(1)}ms | Companies: ${res2.companiesCount}`);

  console.log('\n--- CALL 3: Cache Hit 2 ---');
  const res3 = await getOptimizedJobsAll(testUser);
  console.log(`Call 3 completed in: ${res3.durationMs.toFixed(1)}ms | Companies: ${res3.companiesCount}`);
}

main().catch(console.error);

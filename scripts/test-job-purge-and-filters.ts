import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
import { createAdminClient } from '../lib/supabase/admin';
import {
  isIndiaLocation,
  isJobFresh,
  isJuniorJob,
  normalizeJobUrl,
  normalizeJobTitle,
  cleanJobTitle,
  getJobTitleFingerprint,
  isJobEligible
} from '../lib/jobs/job-filters';

async function main() {
  console.log('===============================================================');
  console.log('🧪 TEST SUITE: Job Pruning Policy & Target Company Filters');
  console.log('===============================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (detail) console.error(`     Detail: ${detail}`);
    }
  }

  const supabase = createAdminClient();

  // -------------------------------------------------------------
  // TEST GROUP 1: Database Pruning & Daily Purge Policy
  // -------------------------------------------------------------
  console.log('--- TEST GROUP 1: Database State & Pruning Policy ---');
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffIso = thirtyDaysAgo.toISOString();

  const { count: totalJobs } = await supabase
    .from('scraped_jobs')
    .select('*', { count: 'exact', head: true });

  const { count: staleJobsCount } = await supabase
    .from('scraped_jobs')
    .select('*', { count: 'exact', head: true })
    .lt('posted_at', cutoffIso);

  const { count: nullOldJobsCount } = await supabase
    .from('scraped_jobs')
    .select('*', { count: 'exact', head: true })
    .is('posted_at', null)
    .lt('created_at', cutoffIso);

  assert(staleJobsCount === 0, 'Zero jobs older than 30 days in database', `Found ${staleJobsCount} stale jobs`);
  assert(nullOldJobsCount === 0, 'Zero orphaned jobs with null posted_at older than 30 days', `Found ${nullOldJobsCount} orphaned jobs`);
  assert((totalJobs || 0) > 0 && (totalJobs || 0) < 1000, `Active jobs in database are in expected clean range (~400-500)`, `Found ${totalJobs} jobs`);

  // Test the automated purge batch query mechanism
  const { data: purgeBatch, error: purgeErr } = await supabase
    .from('scraped_jobs')
    .delete()
    .lt('posted_at', cutoffIso)
    .order('id', { ascending: true })
    .select('id')
    .limit(500);

  assert(!purgeErr, 'Daily purge batch query executes without PostgREST PGRST109 error', purgeErr?.message);
  assert(purgeBatch?.length === 0, 'Daily purge query cleanly returns 0 when table is already pruned', `Returned ${purgeBatch?.length}`);

  // -------------------------------------------------------------
  // TEST GROUP 2: India Location Filter Verification
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: India Location Filter (isIndiaLocation) ---');
  
  // Positive cases (must return true)
  const positiveLocations = [
    'Bengaluru, Karnataka',
    'Bangalore, India',
    'Mumbai, Maharashtra',
    'Pune',
    'New Delhi, Delhi',
    'Gurgaon, Haryana',
    'Gurugram',
    'Noida, Uttar Pradesh',
    'Hyderabad, Telangana',
    'Chennai, Tamil Nadu',
    'Kolkata, West Bengal',
    'Kochi, Kerala',
    'Remote, India',
    'India - Remote',
    'Remote (India)',
    'Work from home - India',
    'Ahmedabad',
    'Indore, Madhya Pradesh',
    'Jaipur, Rajasthan',
    'Mohali, Punjab',
  ];

  let allPositivePassed = true;
  for (const loc of positiveLocations) {
    if (!isIndiaLocation(loc)) {
      allPositivePassed = false;
      console.error(`     Failed on positive location: "${loc}"`);
    }
  }
  assert(allPositivePassed, `All ${positiveLocations.length} Indian tech hubs & Indian remotes correctly qualify`);

  // Negative cases (foreign / foreign-remote - must return false)
  const negativeLocations = [
    'Remote - US',
    'Remote (United States)',
    'Remote - USA',
    'Remote, San Francisco',
    'Remote (US/Canada)',
    'New York, NY',
    'London, United Kingdom',
    'London, UK',
    'Berlin, Germany',
    'Sydney, Australia',
    'Toronto, Canada',
    'Paris, France',
    'Remote - EMEA',
    'Remote - APAC',
    'Singapore',
    'Dublin, Ireland',
    'Amsterdam, Netherlands',
    'Zurich, Switzerland',
  ];

  let allNegativePassed = true;
  for (const loc of negativeLocations) {
    if (isIndiaLocation(loc)) {
      allNegativePassed = false;
      console.error(`     Failed on foreign location: "${loc}" (returned true, should be false)`);
    }
  }
  assert(allNegativePassed, `All ${negativeLocations.length} foreign locations & US/EMEA remotes correctly disqualified`);

  // Omitted / blank location handling
  const blankWithIndiaDesc = isIndiaLocation(null, 'This role is based out of our Bengaluru development center.');
  const blankWithForeignDesc = isIndiaLocation(null, 'This position is based in our San Francisco headquarters.');
  const blankWithNoDesc = isIndiaLocation(null, null);

  assert(blankWithIndiaDesc === true, 'Omitted location with India description qualifies', 'Should be true');
  assert(blankWithForeignDesc === false, 'Omitted location with foreign description is rejected', 'Should be false');
  assert(blankWithNoDesc === false, 'Omitted location with no description is rejected', 'Should be false');

  // -------------------------------------------------------------
  // TEST GROUP 3: 30-Day Freshness Filter (isJobFresh)
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: 30-Day Freshness Filter (isJobFresh) ---');
  
  const d5Ago = new Date();
  d5Ago.setDate(d5Ago.getDate() - 5);
  const d28Ago = new Date();
  d28Ago.setDate(d28Ago.getDate() - 28);
  const d35Ago = new Date();
  d35Ago.setDate(d35Ago.getDate() - 35);
  const d90Ago = new Date();
  d90Ago.setDate(d90Ago.getDate() - 90);

  assert(isJobFresh(d5Ago.toISOString(), 30) === true, 'Job 5 days old is fresh (<= 30d)');
  assert(isJobFresh(d28Ago.toISOString(), 30) === true, 'Job 28 days old is fresh (<= 30d)');
  assert(isJobFresh(d35Ago.toISOString(), 30) === false, 'Job 35 days old is rejected (> 30d)');
  assert(isJobFresh(d90Ago.toISOString(), 30) === false, 'Job 90 days old is rejected (> 30d)');
  assert(isJobFresh(null, 30) === true, 'Job with no posted_at defaults to fresh');

  // -------------------------------------------------------------
  // TEST GROUP 4: URL Normalization & Deduplication
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: URL Normalization & Deduplication ---');

  const rawUrl1 = 'https://jobs.lever.co/company/abc-123/?utm_source=linkedin&gh_jid=456&mode=apply#section-requirements';
  const rawUrl2 = 'https://jobs.lever.co/company/abc-123';
  const rawUrl3 = 'https://jobs.lever.co/company/abc-123/';

  const norm1 = normalizeJobUrl(rawUrl1);
  const norm2 = normalizeJobUrl(rawUrl2);
  const norm3 = normalizeJobUrl(rawUrl3);

  assert(norm1 === norm2, 'Normalized tracking URL matches base URL', `norm1: ${norm1}, norm2: ${norm2}`);
  assert(norm2 === norm3, 'Trailing slash is normalized cleanly', `norm2: ${norm2}, norm3: ${norm3}`);

  const title1 = 'Senior Software Engineer - Backend (Go / Python)';
  const title2 = 'Senior Software Engineer, Backend (Go/Python)';
  assert(getJobTitleFingerprint(title1) === getJobTitleFingerprint(title2), 'Titles with varying punctuation normalize to same fingerprint');
  assert(cleanJobTitle('enterprisecustomersuccessmanager') === 'Enterprise Customer Success Manager', 'Unspaced concatenated title is segmented into spaced words');
  assert(cleanJobTitle('seniorconsultant') === 'Senior Consultant', 'Unspaced seniorconsultant is segmented into Senior Consultant');

  // -------------------------------------------------------------
  // TEST GROUP 5: End-to-End Filter Pipeline Simulation
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Target Company Scrape Pipeline Simulation ---');

  const simulatedScrapedJobs = [
    {
      title: 'Principal Software Engineer',
      location: 'San Francisco, CA',
      description: 'US core infrastructure role',
      posted_at: d5Ago.toISOString(),
      url: 'https://careers.example.com/job-1-us'
    },
    {
      title: 'Director of Engineering',
      location: 'Bengaluru, India',
      description: 'Leading mobile and web engineering',
      posted_at: d35Ago.toISOString(), // Stale > 30 days
      url: 'https://careers.example.com/job-2-stale'
    },
    {
      title: 'Software Engineer Intern',
      location: 'Pune, India',
      description: 'Internship for college freshers',
      posted_at: d5Ago.toISOString(), // Junior role
      url: 'https://careers.example.com/job-3-intern'
    },
    {
      title: 'Staff Software Engineer',
      location: 'Hyderabad, India',
      description: 'Architecting high-scale distributed backend systems with 5+ years experience',
      posted_at: d5Ago.toISOString(),
      url: 'https://careers.example.com/job-4-valid'
    },
    {
      title: 'Senior Product Manager',
      location: 'Remote - India',
      description: 'Product lifecycle for India payments ecosystem with 4+ years experience',
      posted_at: d5Ago.toISOString(),
      url: 'https://careers.example.com/job-5-valid'
    }
  ];

  const eligibleSimulated = simulatedScrapedJobs.filter(j => isJobEligible(j).eligible);

  assert(eligibleSimulated.length === 2, 'Simulated scrape retains exactly 2 valid Indian senior jobs (< 30d)', `Retained: ${eligibleSimulated.length}`);
  assert(eligibleSimulated.some(j => j.title === 'Staff Software Engineer'), 'Staff Software Engineer (Hyderabad) passed');
  assert(eligibleSimulated.some(j => j.title === 'Senior Product Manager'), 'Senior Product Manager (Remote - India) passed');
  assert(!eligibleSimulated.some(j => j.title === 'Principal Software Engineer'), 'US job correctly rejected');
  assert(!eligibleSimulated.some(j => j.title === 'Director of Engineering'), 'Stale >30d job correctly rejected');
  assert(!eligibleSimulated.some(j => j.title === 'Software Engineer Intern'), 'Intern job correctly rejected');

  // Summary
  console.log('\n===============================================================');
  console.log(`🏁 TEST RESULTS: ${passedTests} / ${totalTests} tests passed`);
  console.log('===============================================================');

  if (passedTests === totalTests) {
    console.log('🎉 ALL VALIDATION TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  } else {
    console.error('⚠️ SOME TESTS FAILED!\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

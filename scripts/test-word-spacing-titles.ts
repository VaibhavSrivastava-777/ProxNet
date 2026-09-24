import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { createAdminClient } from '../lib/supabase/admin';
import {
  cleanJobTitle,
  normalizeJobTitle,
  splitUnspacedTitle,
  getJobTitleFingerprint
} from '../lib/jobs/job-filters';

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 TEST SUITE: Job Title Word Spacing & Formatting Validation');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}`);
      if (detail) console.error(`     Detail: ${detail}`);
    }
  }

  // -------------------------------------------------------------
  // TEST GROUP 1: Word Segmentation & Spacing Algorithm
  // -------------------------------------------------------------
  console.log('--- TEST GROUP 1: Word Segmentation & Casing ---');

  const testCases = [
    {
      input: 'enterprisecustomersuccessmanager',
      expected: 'Enterprise Customer Success Manager',
      desc: 'User specified test case: enterprisecustomersuccessmanager',
    },
    {
      input: 'seniorconsultant',
      expected: 'Senior Consultant',
      desc: 'Two-word concatenated title: seniorconsultant',
    },
    {
      input: 'principalsoftwareengineer',
      expected: 'Principal Software Engineer',
      desc: 'Three-word concatenated engineering role: principalsoftwareengineer',
    },
    {
      input: 'growthmarketingmanager',
      expected: 'Growth Marketing Manager',
      desc: 'Concatenated marketing role: growthmarketingmanager',
    },
    {
      input: 'EnterpriseCustomerSuccessManager',
      expected: 'Enterprise Customer Success Manager',
      desc: 'CamelCase / PascalCase title segmentation',
    },
    {
      input: 'lead_product_manager',
      expected: 'Lead Product Manager',
      desc: 'Underscore-separated title cleanup',
    },
    {
      input: 'SENIOR DATA SCIENTIST',
      expected: 'Senior Data Scientist',
      desc: 'ALL CAPS title normalized to proper casing',
    },
    {
      input: 'senior ai research scientist',
      expected: 'Senior AI Research Scientist',
      desc: 'Acronym uppercase preservation (AI)',
    },
  ];

  for (const tc of testCases) {
    const output = cleanJobTitle(tc.input);
    assert(output === tc.expected, tc.desc, `Got: "${output}", Expected: "${tc.expected}"`);
  }

  // -------------------------------------------------------------
  // TEST GROUP 2: normalizeJobTitle vs getJobTitleFingerprint
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Deduplication vs Display Separation ---');

  const rawTitle = 'Enterprise Customer Success Manager';
  const normTitle = normalizeJobTitle(rawTitle);
  const fingerprint = getJobTitleFingerprint(rawTitle);

  assert(normTitle.includes(' '), 'normalizeJobTitle preserves spaces for display', `Got: "${normTitle}"`);
  assert(normTitle === 'Enterprise Customer Success Manager', 'normalizeJobTitle maintains human-readable formatting');
  assert(!fingerprint.includes(' '), 'getJobTitleFingerprint removes spaces strictly for duplicate matching');
  assert(fingerprint === 'enterprisecustomersuccessmanager', 'getJobTitleFingerprint creates alphanumeric hash');

  // Punctuation variation fingerprinting
  const variantA = 'Senior Software Engineer - Backend (Go/Python)';
  const variantB = 'Senior Software Engineer, Backend (Go / Python)';
  assert(
    getJobTitleFingerprint(variantA) === getJobTitleFingerprint(variantB),
    'Punctuation variants yield identical deduplication fingerprint'
  );

  // -------------------------------------------------------------
  // TEST GROUP 3: Database Verification (scraped_jobs table)
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Live Database Verification ---');

  const supabase = createAdminClient();

  const { data: allJobs, error: dbErr } = await supabase
    .from('scraped_jobs')
    .select('id, title, company')
    .limit(2000);

  assert(!dbErr, 'Database query succeeds without error', dbErr?.message);

  if (allJobs && allJobs.length > 0) {
    console.log(`  📊 Auditing ${allJobs.length} live database jobs for word spacing...`);

    const unspacedJobs = allJobs.filter(j => {
      const t = (j.title || '').trim();
      return t.length > 10 && !t.includes(' ') && !t.includes('-') && !t.includes('/');
    });

    assert(
      unspacedJobs.length === 0,
      `All ${allJobs.length} database jobs have clean, properly spaced titles (0 unspaced)`,
      unspacedJobs.length > 0 ? `Found ${unspacedJobs.length} unspaced: ${JSON.stringify(unspacedJobs.slice(0, 3))}` : undefined
    );
  }

  // -------------------------------------------------------------
  // FINAL SUMMARY
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`🏁 VALIDATION SUMMARY: ${passed} / ${total} tests passed`);
  console.log('===============================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

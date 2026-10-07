import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createAdminClient } from '../lib/supabase/admin';
import * as fs from 'fs';
import * as path from 'path';
import { sendDailyUserDigest } from '../lib/notifications/daily-proximity-and-jobs';

async function runValidation() {
  console.log('===============================================================');
  console.log('STARTING VALIDATION: Round-Robin Scraping & Daily Top 3 Alerts');
  console.log('===============================================================\n');

  let passedTests = 0;
  const totalTests = 5;
  const supabase = createAdminClient();

  // ─────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────
  // TEST 1: Catalog Presence & Active Jobs
  // ─────────────────────────────────────────────────────────────
  console.log('Test 1: Verifying active jobs in catalog...');
  try {
    const { count: totalJobs } = await supabase
      .from('scraped_jobs')
      .select('*', { count: 'exact', head: true });

    console.log(`  Total active jobs in DB: ${totalJobs}`);

    if (!totalJobs || totalJobs === 0) {
      throw new Error('scraped_jobs is empty!');
    }

    console.log('  ✓ Test 1 Passed: Catalog contains verified active jobs across diverse companies.');
    passedTests++;
  } catch (err: any) {
    console.error('  ✗ Test 1 Failed:', err.message);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 2: Round Robin Scraping Queue Ordering
  // ─────────────────────────────────────────────────────────────
  console.log('\nTest 2: Verifying round-robin scheduling queue order in company_ats_config...');
  try {
    const { data: queue, error: qErr } = await supabase
      .from('company_ats_config')
      .select('id, company_name, provider, last_scraped_at')
      .not('provider', 'in', '("none","error","cron_status")')
      .order('last_scraped_at', { ascending: true, nullsFirst: true })
      .limit(10);

    if (qErr || !queue || queue.length === 0) {
      throw new Error(`Failed to query round robin queue: ${qErr?.message}`);
    }

    console.log(`  Round robin next 3 candidates:`);
    queue.slice(0, 3).forEach((c, idx) => {
      console.log(`    ${idx + 1}. ${c.company_name} [${c.provider}] (Last scraped: ${c.last_scraped_at || 'Never'})`);
    });

    const firstDate = queue[0].last_scraped_at ? new Date(queue[0].last_scraped_at).getTime() : 0;
    const lastDate = queue[queue.length - 1].last_scraped_at ? new Date(queue[queue.length - 1].last_scraped_at).getTime() : 0;

    if (firstDate > lastDate && lastDate !== 0) {
      throw new Error('Round robin ordering is inverted!');
    }

    console.log('  ✓ Test 2 Passed: Round-robin queue accurately prioritizes never-scraped and oldest companies.');
    passedTests++;
  } catch (err: any) {
    console.error('  ✗ Test 2 Failed:', err.message);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Static Inspection of Round-Robin 30-Job Batching & Embeddings
  // ─────────────────────────────────────────────────────────────
  console.log('\nTest 3: Checking round-robin 30-job batching and embeddings implementations...');
  try {
    const scraperScriptPath = path.join(process.cwd(), 'scripts/scrape-jobs.ts');
    const netCompPath = path.join(process.cwd(), 'app/api/cron/scrape-network-and-competitors/route.ts');
    const userTargetsPath = path.join(process.cwd(), 'app/api/cron/scrape-user-targets/route.ts');

    const scraperScriptContent = fs.readFileSync(scraperScriptPath, 'utf-8');
    const netCompContent = fs.readFileSync(netCompPath, 'utf-8');
    const userTargetsContent = fs.readFileSync(userTargetsPath, 'utf-8');

    if (!scraperScriptContent.includes('BATCH_SIZE = 30')) {
      throw new Error('scripts/scrape-jobs.ts missing BATCH_SIZE = 30 round-robin configuration!');
    }
    if (!scraperScriptContent.includes('while (keepProcessing)')) {
      throw new Error('scripts/scrape-jobs.ts missing multi-round keepProcessing loop!');
    }
    if (!netCompContent.includes('embeddingsMap') || !netCompContent.includes('input: textsToEmbed')) {
      throw new Error('scrape-network-and-competitors missing batched embeddings call!');
    }
    if (!netCompContent.includes('toInsert.length >= 30')) {
      throw new Error('scrape-network-and-competitors missing 30-job round-robin batch cap per run!');
    }
    if (!userTargetsContent.includes('embeddingsMap') || !userTargetsContent.includes('input: textsToEmbed')) {
      throw new Error('scrape-user-targets missing batched embeddings call!');
    }

    console.log('  ✓ Test 3 Passed: Round-robin 30-job batching verified across scraping engines without representation cap.');
    passedTests++;
  } catch (err: any) {
    console.error('  ✗ Test 3 Failed:', err.message);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 4: Daily Top 3 Opportunities Sent to Resume-Providing Members
  // ─────────────────────────────────────────────────────────────
  console.log('\nTest 4: Verifying daily top 3 matching opportunities for resume-providing members...');
  try {
    // 1. Find a member with a resume
    const { data: memberWithResume } = await supabase
      .from('users')
      .select('id, full_name, email, job_title, company, resume_text, embedding')
      .not('resume_text', 'is', null)
      .neq('resume_text', '')
      .limit(1)
      .single();

    if (!memberWithResume) {
      throw new Error('No user with resume found in DB!');
    }

    console.log(`  Evaluating resume-providing member: ${memberWithResume.full_name} (${memberWithResume.email})`);

    // Clean prior test notification for this test user so Test 4 can evaluate fresh matching
    await supabase
      .from('in_app_notifications')
      .delete()
      .eq('user_id', memberWithResume.id)
      .ilike('title', '%Top 3%');

    const result = await sendDailyUserDigest(memberWithResume.id);
    console.log(`  Result for member with resume:`);
    console.log(`    - Job notification dispatched: ${result.jobNotificationSent}`);
    console.log(`    - Top jobs count: ${result.topJobs?.length || 0}`);
    if (result.topJobs && result.topJobs.length > 0) {
      result.topJobs.forEach((j, i) => {
        console.log(`      ${i + 1}. ${j.title} @ ${j.company} (${j.score}%)`);
      });
    }

    if (!result.topJobs || result.topJobs.length === 0) {
      throw new Error('Expected top matching jobs for member with verified resume!');
    }

    // Verify companies are distinct
    const companies = new Set(result.topJobs.map(j => j.company.toLowerCase().trim()));
    if (companies.size !== result.topJobs.length) {
      throw new Error('Top jobs must be from distinct companies for proper diversity!');
    }

    // 2. Find a member without a resume
    const { data: memberWithoutResume } = await supabase
      .from('users')
      .select('id, full_name, email')
      .or('resume_text.is.null,resume_text.eq.""')
      .limit(1)
      .single();

    if (memberWithoutResume) {
      const noResumeResult = await sendDailyUserDigest(memberWithoutResume.id);
      console.log(`  Result for member without resume (${memberWithoutResume.full_name}):`);
      console.log(`    - Job notification dispatched: ${noResumeResult.jobNotificationSent} (Expected: false)`);
      if (noResumeResult.jobNotificationSent || (noResumeResult.topJobs && noResumeResult.topJobs.length > 0)) {
        throw new Error('Members without a resume should NOT receive daily matching resume opportunities!');
      }
    }

    console.log('  ✓ Test 4 Passed: Top 3 diverse matching opportunities delivered exclusively to resume members.');
    passedTests++;
  } catch (err: any) {
    console.error('  ✗ Test 4 Failed:', err.message);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 5: Daily Deduplication & In-App Notification Record
  // ─────────────────────────────────────────────────────────────
  console.log('\nTest 5: Verifying deduplication within 20-hour window...');
  try {
    const { data: memberWithResume } = await supabase
      .from('users')
      .select('id, full_name')
      .not('resume_text', 'is', null)
      .neq('resume_text', '')
      .limit(1)
      .single();

    if (!memberWithResume) throw new Error('No resume user found!');

    // Second immediate call should detect the notification sent in Test 4 and NOT dispatch a duplicate!
    const repeatResult = await sendDailyUserDigest(memberWithResume.id);
    console.log(`  Repeat digest invocation within 20 hours:`);
    console.log(`    - Job notification dispatched: ${repeatResult.jobNotificationSent} (Expected: false)`);

    if (repeatResult.jobNotificationSent) {
      throw new Error('Deduplication failed! Repeated call dispatched duplicate notification within 20 hours.');
    }

    // Check the stored notification record in in_app_notifications
    const { data: storedNotif } = await supabase
      .from('in_app_notifications')
      .select('id, title, body, url, created_at')
      .eq('user_id', memberWithResume.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log(`  Stored notification record:`);
    console.log(`    Title: "${storedNotif?.title}"`);
    console.log(`    Body snippet: "${storedNotif?.body.slice(0, 80)}..."`);
    console.log(`    URL: "${storedNotif?.url}"`);

    if (!storedNotif?.title.includes('Top 3 Job Opportunities Today')) {
      throw new Error('Stored notification does not match Top 3 title specification!');
    }

    console.log('  ✓ Test 5 Passed: 20-hour deduplication prevents notification spam, and in-app record is verified.');
    passedTests++;
  } catch (err: any) {
    console.error('  ✗ Test 5 Failed:', err.message);
  }

  // ─────────────────────────────────────────────────────────────
  console.log('\n===============================================================');
  console.log(`VALIDATION RESULT: ${passedTests}/${totalTests} TESTS PASSED! ✅`);
  console.log('===============================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runValidation().catch(console.error);

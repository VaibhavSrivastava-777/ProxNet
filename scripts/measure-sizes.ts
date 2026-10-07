import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createAdminClient } from '../lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysIso = thirtyDaysAgo.toISOString();

  const ranges = [[0, 999], [1000, 1999], [2000, 2999], [3000, 3999], [4000, 4999], [5000, 5999], [6000, 6999]];
  const batches = await Promise.all(
    ranges.map(([s, e]) =>
      supabase.from('scraped_jobs').select('id, company, title, location, url, posted_at, keywords, description').gte('posted_at', thirtyDaysIso).range(s, e)
    )
  );
  const allJobs = batches.flatMap(b => b.data || []);
  
  // Measure full size with full description:
  const fullBytes = Buffer.byteLength(JSON.stringify(allJobs), 'utf-8');

  // Measure size with description truncated to 200 chars or summary:
  const lightweightJobs = allJobs.map(j => ({
    id: j.id,
    company: j.company,
    title: j.title,
    location: j.location,
    url: j.url,
    posted_at: j.posted_at,
    keywords: j.keywords,
    description: (j.description || '').slice(0, 250),
  }));
  const lightBytes = Buffer.byteLength(JSON.stringify(lightweightJobs), 'utf-8');

  console.log(`Full 7k jobs JSON size: ${(fullBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Lightweight 7k jobs JSON size: ${(lightBytes / 1024 / 1024).toFixed(2)} MB`);
}

main().catch(console.error);

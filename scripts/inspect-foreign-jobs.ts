import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { createAdminClient } from '../lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('scraped_jobs')
    .select('id, title, location, company, description, url, posted_at');

  if (error) {
    console.error('Error fetching jobs:', error);
    return;
  }

  console.log(`Total jobs in database: ${data?.length}`);

  const foreignMatches: any[] = [];

  for (const job of data || []) {
    const title = (job.title || '');
    const loc = (job.location || '');
    const combined = `${title} ${loc}`.toLowerCase();

    // Check for foreign indicators in title or location
    const hasUsaStatePattern = /\bUSA-[A-Z]{2}\b/i.test(title) || /\bUSA-[A-Z]{2}\b/i.test(loc);
    const hasExplicitUsa = /\b(usa|united states|u\.s\.a\.)\b/i.test(title) || /\b(usa|united states|u\.s\.a\.)\b/i.test(loc);
    const hasUsBoundary = /(^|[\s\(\[\-\–\—\/\|,])(us|u\.s\.)([\s\)\]\-\–\—\/\|,.]|$)/i.test(title) || /(^|[\s\(\[\-\–\—\/\|,])(us|u\.s\.)([\s\)\]\-\–\—\/\|,.]|$)/i.test(loc);
    const hasForeignCity = [
      'san francisco', 'seattle', 'mountain view', 'sunnyvale', 'santa clara',
      'tampa', 'atlanta', 'austin', 'chicago', 'boston', 'los angeles', 'redmond',
      'fort mill', 'jefferson city', 'columbus', 'houston', 'philadelphia',
      'minneapolis', 'new jersey', 'fairhaven', 'london', 'toronto', 'vancouver',
      'sydney', 'melbourne', 'singapore', 'dublin', 'berlin', 'paris'
    ].some(city => combined.includes(city));

    const mentionsIndia = combined.includes('india') || combined.includes('bengaluru') || combined.includes('bangalore') || combined.includes('mumbai') || combined.includes('pune') || combined.includes('delhi') || combined.includes('hyderabad') || combined.includes('chennai') || combined.includes('noida') || combined.includes('gurgaon');

    if ((hasUsaStatePattern || hasExplicitUsa || hasUsBoundary || hasForeignCity) && !mentionsIndia) {
      foreignMatches.push({
        company: job.company,
        title: job.title,
        location: job.location,
      });
    }
  }

  console.log(`Foreign / USA jobs found: ${foreignMatches.length}`);
  console.log('Sample foreign jobs:');
  console.table(foreignMatches.slice(0, 30));
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });

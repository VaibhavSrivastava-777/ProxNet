import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createAdminClient } from '../lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();

  const { data: wiproSample } = await supabase
    .from('scraped_jobs')
    .select('id, title, location, posted_at, created_at, source')
    .ilike('company', '%wipro%')
    .limit(10);

  console.log('Sample Wipro jobs:');
  console.table(wiproSample);

  // Check oldest and newest created_at for Wipro
  const { data: newest } = await supabase
    .from('scraped_jobs')
    .select('created_at, posted_at')
    .ilike('company', '%wipro%')
    .order('created_at', { ascending: false })
    .limit(1);

  const { data: oldest } = await supabase
    .from('scraped_jobs')
    .select('created_at, posted_at')
    .ilike('company', '%wipro%')
    .order('created_at', { ascending: true })
    .limit(1);

  console.log('Newest Wipro created_at:', newest?.[0]);
  console.log('Oldest Wipro created_at:', oldest?.[0]);
}

main().catch(console.error);

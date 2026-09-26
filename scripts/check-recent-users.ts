import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { createAdminClient } from '../lib/supabase/admin';

async function checkVaibhav() {
  const supabase = createAdminClient();
  const { data: users } = await supabase.from('users').select('*').ilike('full_name', '%vaibhav%');
  for (const u of users || []) {
    console.log(`Vaibhav user: id=${u.id}, name=${u.full_name}, email=${u.email}, home_lat=${u.home_lat}, home_lng=${u.home_lng}, company=${u.company}, title=${u.job_title}`);
  }

  // Also check non-Vaibhav users who are logged in recently or have updated profiles
  const { data: recentUsers } = await supabase
    .from('users')
    .select('id, full_name, email, company, job_title, home_lat, home_lng, home_name, updated_at')
    .order('updated_at', { ascending: false })
    .limit(10);

  console.log('\n--- 10 Most Recently Updated Users ---');
  for (const u of recentUsers || []) {
    console.log(`- [${u.id.slice(0, 8)}] ${u.full_name} (${u.email}) | Co: ${u.company} | Title: ${u.job_title} | Lat/Lng: (${u.home_lat}, ${u.home_lng}) | HomeName: ${u.home_name} | Updated: ${u.updated_at}`);
  }
}

checkVaibhav().catch(console.error);

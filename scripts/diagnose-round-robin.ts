import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createAdminClient } from '../lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();

  // 1. Check configs in company_ats_config
  const { data: configs, error: cfgErr } = await supabase
    .from('company_ats_config')
    .select('*')
    .limit(10);

  if (cfgErr) {
    console.error('Error fetching company_ats_config:', cfgErr);
  } else {
    console.log(`Successfully fetched ${configs?.length} sample configs.`);
    if (configs && configs.length > 0) {
      console.log('Sample columns:', Object.keys(configs[0]));
      console.log('First config:', configs[0]);
    }
  }

  const { count: totalConfigs } = await supabase
    .from('company_ats_config')
    .select('*', { count: 'exact', head: true });
  console.log(`Total configs in DB: ${totalConfigs}`);

  // Distinct companies in scraped_jobs
  const { data: scrapedCompanies } = await supabase
    .from('scraped_jobs')
    .select('company');
  
  const compCounts: Record<string, number> = {};
  for (const j of scrapedCompanies || []) {
    const c = (j.company || 'Unknown').trim();
    compCounts[c] = (compCounts[c] || 0) + 1;
  }
  const sorted = Object.entries(compCounts).sort((a, b) => b[1] - a[1]);
  console.log('\nTop 15 companies in scraped_jobs by volume:');
  console.table(sorted.slice(0, 15).map(([c, count]) => ({ company: c, count })));
}

main().catch(console.error);

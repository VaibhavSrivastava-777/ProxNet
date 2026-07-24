import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
import { createAdminClient } from '../lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  
  console.log(`Purging jobs older than: ${oneMonthAgo.toISOString()}`);
  
  const { data, error, count } = await supabase
    .from("scraped_jobs")
    .delete()
    .lt("posted_at", oneMonthAgo.toISOString())
    .select();
    
  if (error) {
    console.error("Purge Error:", error);
  } else {
    console.log(`Successfully purged ${data?.length || 0} jobs.`);
  }
}
main();

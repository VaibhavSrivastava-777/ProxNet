import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function removeSimulatedJobs() {
  const { data, error } = await supabase
    .from('scraped_jobs')
    .delete()
    .eq('ats_source', 'simulated');

  if (error) {
    console.error('Error removing simulated jobs:', error);
  } else {
    console.log('Successfully removed simulated jobs.');
  }
}

removeSimulatedJobs();

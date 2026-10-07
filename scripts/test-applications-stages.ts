import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createAdminClient } from '../lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('job_applications')
    .select('id, stage, company, job_title, notes')
    .limit(20);

  console.log('Error:', error);
  console.log('Found records:', data?.length);
  if (data && data.length > 0) {
    for (const row of data) {
      console.log(`- [${row.stage}] ${row.company} : ${row.job_title} | notes has strengths: ${row.notes?.includes('strengths')}`);
    }
  }

  // Check what stages are allowed by testing an update or insert
  const testId = data?.[0]?.id;
  if (testId) {
    const originalStage = data[0].stage;
    const { error: testPipeErr } = await supabase
      .from('job_applications')
      .update({ stage: 'pipe' })
      .eq('id', testId);
    console.log("Update to 'pipe' error:", testPipeErr ? testPipeErr.message : 'SUCCESS! pipe allowed');

    // restore
    await supabase.from('job_applications').update({ stage: originalStage }).eq('id', testId);
  }
}

main().catch(console.error);

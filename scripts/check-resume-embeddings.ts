import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createAdminClient } from '../lib/supabase/admin';

async function checkResumeUsers() {
  const supabase = createAdminClient();

  const { data: resumeUsers } = await supabase
    .from('users')
    .select('id, full_name, email, job_title, company, resume_text, embedding')
    .not('resume_text', 'is', null)
    .neq('resume_text', '');

  let withEmb = 0;
  let withoutEmb = 0;

  for (const u of resumeUsers || []) {
    if (u.embedding) withEmb++;
    else withoutEmb++;
  }

  console.log(`Total resume users: ${resumeUsers?.length}`);
  console.log(`With embedding: ${withEmb}`);
  console.log(`Without embedding: ${withoutEmb}`);
}

checkResumeUsers().catch(console.error);

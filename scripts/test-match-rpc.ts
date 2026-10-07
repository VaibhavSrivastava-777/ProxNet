import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createAdminClient } from '../lib/supabase/admin';

async function testMatch() {
  const supabase = createAdminClient();

  // Find a user with resume and embedding
  const { data: user } = await supabase
    .from('users')
    .select('id, full_name, email, job_title, company, resume_text, embedding')
    .not('resume_text', 'is', null)
    .not('embedding', 'is', null)
    .limit(1)
    .single();

  console.log('Testing with user:', {
    name: user?.full_name,
    email: user?.email,
    title: user?.job_title,
    company: user?.company,
    resumeLen: user?.resume_text?.length,
    hasEmbedding: Array.isArray(user?.embedding),
  });

  if (!user || !user.embedding) {
    console.log('No user with embedding found.');
    return;
  }

  const { data: matches, error } = await supabase.rpc('match_scraped_jobs', {
    query_embedding: user.embedding,
    match_threshold: 0.15,
    match_count: 20,
  });

  console.log('RPC error:', error);
  console.log(`Found ${matches?.length || 0} matches.`);
  if (matches && matches.length > 0) {
    console.table(matches.slice(0, 5).map((m: any) => ({
      title: m.title,
      company: m.company,
      similarity: m.similarity,
      posted_at: m.posted_at,
    })));
  }
}

testMatch().catch(console.error);

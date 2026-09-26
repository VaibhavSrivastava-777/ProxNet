import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { createAdminClient } from '../lib/supabase/admin';

async function testAsUsers() {
  const supabase = createAdminClient();

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email, job_title, company, home_lat, home_lng, embedding, resume_text, about, is_active')
    .eq('is_active', true);

  console.log(`Testing for ${users.length} active users...\n`);

  for (const u of users.slice(0, 10)) {
    console.log(`\n================ User: ${u.full_name} (${u.email}) ================`);
    console.log(`Title: "${u.job_title}", Company: "${u.company}"`);
    console.log(`Home: (${u.home_lat}, ${u.home_lng}), Has Embedding: ${Boolean(u.embedding)}, Has Resume: ${Boolean(u.resume_text)}`);

    // 1. Test Jobs RPC match
    if (u.embedding) {
      const { data: matchedJobs, error: mErr } = await supabase.rpc("match_scraped_jobs", {
        query_embedding: u.embedding,
        match_threshold: 0.25,
        match_count: 45
      });
      console.log(`Jobs RPC matches (threshold 0.25): ${matchedJobs?.length || 0} jobs`, mErr ? `(Error: ${mErr.message})` : '');
      if (matchedJobs && matchedJobs.length > 0) {
        console.log(`  Top 3 jobs:`, matchedJobs.slice(0, 3).map((j: any) => `${j.title} @ ${j.company} (${Math.round((j.similarity || 0)*100)}%)`).join(' | '));
      }
    } else {
      console.log(`Jobs: NO EMBEDDING on user!`);
    }

    // 2. Test Proximity People
    if (u.home_lat != null && u.home_lng != null) {
      const lat = Number(u.home_lat);
      const lng = Number(u.home_lng);

      // Same query as /api/proximity/people
      const { data: peopleRaw, error: pErr } = await supabase
        .from("users")
        .select("id, full_name, company, job_title, home_lat, home_lng, is_active")
        .eq("is_active", true)
        .neq("id", u.id);

      let countWithin2km = 0;
      let countWithTitleAndCompany = 0;
      for (const p of peopleRaw || []) {
        if (!p.job_title?.trim() || !p.company?.trim()) continue;
        countWithTitleAndCompany++;
        if (p.home_lat != null && p.home_lng != null) {
          // Haversine
          const dLat = (Number(p.home_lat) - lat) * Math.PI / 180;
          const dLng = (Number(p.home_lng) - lng) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(lat * Math.PI / 180) * Math.cos(Number(p.home_lat) * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const dist = 6371000 * c;
          if (dist <= 2000) countWithin2km++;
        }
      }
      console.log(`People in DB with title & company: ${countWithTitleAndCompany} | Within 2km: ${countWithin2km}`);
    } else {
      console.log(`People: User has NO home_lat/home_lng!`);
    }
  }
}

testAsUsers().catch(console.error);

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { createAdminClient } from '../lib/supabase/admin';
import { haversineDistanceMeters } from '../lib/geo/haversine';

async function diagnose() {
  const supabase = createAdminClient();

  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, email, company, job_title, home_lat, home_lng, home_name, office_lat, office_lng, is_active, embedding, profile_digest')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching users:', error);
    return;
  }

  console.log(`Found ${users.length} active users in the database:`);
  for (const u of users) {
    const hasEmbedding = Boolean(u.embedding);
    console.log(`- [${u.id.slice(0, 8)}] ${u.full_name || 'No Name'} (${u.email || 'No Email'}) | Company: ${u.company} | Title: ${u.job_title} | Home: (${u.home_lat}, ${u.home_lng}) [${u.home_name || ''}] | Embedding: ${hasEmbedding}`);
  }

  console.log('\n--- Cross-Distance Matrix (in meters) ---');
  for (let i = 0; i < users.length; i++) {
    const u1 = users[i];
    if (u1.home_lat == null || u1.home_lng == null) {
      console.log(`${u1.full_name} has NO home coordinates!`);
      continue;
    }
    const lat1 = Number(u1.home_lat);
    const lng1 = Number(u1.home_lng);
    const within2km = [];
    const within5km = [];
    const all = [];

    for (let j = 0; j < users.length; j++) {
      if (i === j) continue;
      const u2 = users[j];
      if (u2.home_lat == null || u2.home_lng == null) continue;
      const lat2 = Number(u2.home_lat);
      const lng2 = Number(u2.home_lng);
      const dist = Math.round(haversineDistanceMeters(lat1, lng1, lat2, lng2));
      all.push({ name: u2.full_name, dist });
      if (dist <= 2000) within2km.push({ name: u2.full_name, dist });
      if (dist <= 5000) within5km.push({ name: u2.full_name, dist });
    }

    console.log(`User: ${u1.full_name} (${lat1}, ${lng1}):`);
    console.log(`  Within 2km (${within2km.length}):`, within2km.map(x => `${x.name} (${x.dist}m)`).join(', ') || 'NONE');
    console.log(`  Within 5km (${within5km.length}):`, within5km.map(x => `${x.name} (${x.dist}m)`).join(', ') || 'NONE');
    console.log(`  All (${all.length}):`, all.map(x => `${x.name} (${x.dist}m)`).join(', ') || 'NONE');
  }
}

diagnose().catch(console.error);

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { createAdminClient } from '../lib/supabase/admin';

async function testProximityRoute() {
  const supabase = createAdminClient();

  // Test Chitra Ranganathan in Central Bangalore: lat 12.9628957, lng 77.57754
  const lat = 12.9628957;
  const lng = 77.57754;

  const res = await fetch(`http://localhost:3000/api/proximity/people?lat=${lat}&lng=${lng}&radius=2000`, {
    headers: {
      // Mock or call logic directly
    }
  }).catch(() => null);

  console.log('Testing proximity auto-expansion logic:');
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, company, job_title, home_lat, home_lng, is_active')
    .eq('is_active', true);

  console.log(`Total active users: ${users?.length}`);
}

testProximityRoute().catch(console.error);

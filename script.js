const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SEED_DATA = [
  { category: "Recommendations", body: "Does anyone know a good pediatrician in the Koramangala area? Prefer someone who is good with toddlers.", lat: 12.9279, lng: 77.6271 },
  { category: "General", body: "Has anyone else noticed the frequent power cuts this week in sector 4? Any idea what's going on?", lat: 12.9279, lng: 77.6271 },
  { category: "Events", body: "We're organizing a weekend marathon this Sunday at 6 AM at the local park. Anyone interested in joining?", lat: 12.9279, lng: 77.6271 },
  { category: "Buy/Sell", body: "Selling my 1-year old Herman Miller Aeron chair. Excellent condition. Let me know if interested!", lat: 12.9279, lng: 77.6271 },
  { category: "Help Needed", body: "Lost a golden retriever near the supermarket yesterday evening. Answers to 'Buddy'. Please DM if you spot him!", lat: 12.9279, lng: 77.6271 },
  { category: "Recommendations", body: "Looking for a reliable plumber to fix a persistent leak in the kitchen sink. Urgent!", lat: 12.9279, lng: 77.6271 },
  { category: "General", body: "The new cafe that opened up near the metro station is fantastic. Highly recommend their croissants!", lat: 12.9279, lng: 77.6271 },
  { category: "Events", body: "There's a local farmer's market setting up this Saturday. Great place to get fresh organic produce.", lat: 12.9279, lng: 77.6271 }
];

async function seed() {
  const { data: users } = await supabase.from('users').select('id').limit(5);
  if (!users || users.length === 0) return console.log('No users found');

  const inserts = SEED_DATA.map((seed, i) => {
    return {
      asker_id: users[i % users.length].id,
      body: '[' + seed.category + '] ' + seed.body,
      type: 'forum',
      center_lat: seed.lat,
      center_lng: seed.lng,
      radius_meters: 5000,
      asker_alias: 'Resident ' + (i+1)
    };
  });

  const { data, error } = await supabase.from('questions').insert(inserts).select();
  if (error) console.error(error);
  else console.log('Inserted ' + data.length + ' rows.');
}

seed();

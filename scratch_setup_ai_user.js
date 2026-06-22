const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env.local'});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Checking for AI user...");
  let { data: existing } = await supabase.from('users').select('id').eq('email', 'ai@proxnet.in').maybeSingle();
  if (existing) {
    console.log("AI user exists with ID:", existing.id);
  } else {
    console.log("Creating AI user...");
    const { data: newUser, error } = await supabase.from('users').insert({
      email: 'ai@proxnet.in',
      full_name: 'ProxNet AI',
      job_title: 'Network Assistant',
      company: 'ProxNet',
      source: 'admin',
      is_active: true,
      visibility: { showCompany: true, showTitle: true, showPhoto: true }
    }).select('id').single();
    if (error) {
       console.error("Failed to create AI user:", error);
    } else {
       console.log("AI user created with ID:", newUser.id);
    }
  }
}
run();

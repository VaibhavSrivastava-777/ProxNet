require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from("users").select("id, email, company, job_title, home_lat, office_lat").eq("is_active", true);
  if (error) {
    console.error(error);
    return;
  }
  let incompleteCount = 0;
  for (const u of data) {
    if (!u.company || !u.job_title || (!u.home_lat && !u.office_lat)) {
      incompleteCount++;
      console.log(`Incomplete: ${u.email} (Company: ${u.company}, Title: ${u.job_title}, Home: ${u.home_lat})`);
    }
  }
  console.log(`Total incomplete profiles: ${incompleteCount}`);
}

run();

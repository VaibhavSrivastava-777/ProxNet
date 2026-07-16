const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const path = require("path");

// Load local environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase config is missing!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const code = "PX-G2xLZa";
  console.log(`Simulating join flow for code: ${code}`);

  // 1. Fetch inviter
  const { data: inviter, error: inviterErr } = await supabase
    .from("users")
    .select("id, invite_code")
    .eq("invite_code", code)
    .maybeSingle();

  if (inviterErr) {
    console.error("Error fetching inviter:", inviterErr);
    return;
  }

  if (!inviter) {
    console.error("Inviter not found for code:", code);
    return;
  }

  console.log("Found inviter:", inviter);

  // 2. Insert click event into invite_events
  const { data: event, error: eventErr } = await supabase
    .from("invite_events")
    .insert({
      inviter_id: inviter.id,
      channel: "link",
      invite_code: code,
      clicked: true,
      signed_up: false,
    })
    .select("*")
    .single();

  if (eventErr) {
    console.error("Error inserting invite event:", eventErr);
  } else {
    console.log("Successfully inserted invite event:", event);
  }
}

run();

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
  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("id, full_name, invite_code")
      .not("invite_code", "is", null);

    if (error) {
      console.error("Error fetching non-null invite codes:", error);
    } else {
      console.log(`Found ${users.length} users with invite codes:`);
      users.forEach(u => {
        console.log(`- ${u.full_name}: invite_code='${u.invite_code}'`);
      });
    }
  } catch (e) {
    console.error("Exception:", e);
  }
}

run();

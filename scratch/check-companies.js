const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config({ path: ".env.local" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing credentials");
    return;
  }

  const supabase = createClient(url, key);
  const { data: users, error } = await supabase.from("users").select("company, full_name, email");
  if (error) {
    console.error(error);
    return;
  }

  console.log("Users & their companies:");
  const companies = new Set();
  for (const u of users) {
    console.log(`- User: ${u.full_name} (${u.email}), Company: "${u.company}"`);
    if (u.company) companies.add(u.company.trim());
  }

  console.log("\nUnique Company Names list:", Array.from(companies));
}

main();

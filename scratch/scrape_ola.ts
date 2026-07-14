import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing credentials");
  process.exit(1);
}

async function run() {
  console.log("Fetching Lever jobs for Ola...");
  const res = await fetch("https://api.lever.co/v0/postings/olacabs?mode=json");
  if (!res.ok) {
    console.error(`Failed to fetch from lever: ${res.status}`);
    return;
  }

  const data = await res.json();
  console.log(`Fetched ${data.length} raw jobs from Ola.`);
}

run();

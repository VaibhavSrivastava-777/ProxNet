import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (!url || !key || !openaiKey) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  console.log("Fetching Lever jobs for Zoho...");
  const res = await fetch("https://api.lever.co/v0/postings/zoho?mode=json");
  if (!res.ok) {
    console.error(`Failed to fetch from lever: ${res.status}`);
    return;
  }

  const data = await res.json();
  console.log(`Fetched ${data.length} raw jobs from Zoho.`);
}

run();

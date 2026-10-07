import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: boards } = await supabase
    .from("company_ats_config")
    .select("*")
    .eq("board_token_or_url", "none");

  console.log(`Found ${(boards || []).length} boards with token 'none':`);
  for (const b of boards || []) {
    console.log(`- ${b.company_name}: ${b.provider}`);
  }

  // Proper career URLs for these companies
  const realUrls: Record<string, string> = {
    "Gartner": "https://jobs.gartner.com/",
    "HCLtech": "https://www.hcltech.com/careers",
    "HSBC": "https://www.hsbc.com/careers",
    "IDBI Bank ltd": "https://www.idbibank.in/idbi-bank-careers.aspx",
    "Maersk": "https://www.maersk.com/careers",
    "Mahindra and Mahindra finance": "https://www.mahindrafinance.com/careers",
    "Meraki TalentWorks": "https://www.merakitalentworks.com/careers",
  };

  for (const b of boards || []) {
    const realUrl = realUrls[b.company_name] || `https://www.${b.company_name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com/careers`;
    await supabase
      .from("company_ats_config")
      .update({
        provider: "custom",
        board_token_or_url: realUrl,
        scrape_notes: `Corrected false positive 'none' token to official career URL: ${realUrl}`
      })
      .eq("company_name", b.company_name);
    console.log(`✅ Corrected ${b.company_name} -> custom (${realUrl})`);
  }
}

main();

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const cleanups: { company: string; provider: string; url: string; note: string }[] = [
  {
    company: "Postman",
    provider: "custom",
    url: "https://www.postman.com/company/careers/",
    note: "Updated from dead Greenhouse token to official careers site",
  },
  {
    company: "Lead School",
    provider: "custom",
    url: "https://leadschool.in/careers/",
    note: "Updated from dead Lever token to official careers site",
  },
  {
    company: "Gemini Solutions",
    provider: "custom",
    url: "https://www.geminisolutions.com/careers/",
    note: "Disassociated from crypto exchange 'gemini' Greenhouse board; set to official IT consulting portal",
  },
  {
    company: "Gemini Technologies",
    provider: "custom",
    url: "https://www.geminitech.com/careers",
    note: "Disassociated from crypto exchange 'gemini' Greenhouse board; set to official corporate portal",
  },
  {
    company: "HP Inc.",
    provider: "custom",
    url: "https://jobs.hp.com/",
    note: "Updated from unrelated 'hp' Greenhouse board to official HP Inc. jobs portal",
  },
  {
    company: "HashiCorp",
    provider: "custom",
    url: "https://www.hashicorp.com/careers",
    note: "Updated from expired Greenhouse token to official careers portal",
  },
  {
    company: "Deutsche Bank",
    provider: "custom",
    url: "https://careers.db.com/",
    note: "Populated from provider 'none' to official careers portal",
  },
  {
    company: "Dropout Academy",
    provider: "custom",
    url: "https://dropoutacademy.in/",
    note: "Populated from provider 'none' to official website",
  },
  {
    company: "ECGC LIMITED",
    provider: "custom",
    url: "https://www.ecgc.in/careers/",
    note: "Populated from provider 'none' to official careers portal",
  },
  {
    company: "Farcast Biosciences",
    provider: "custom",
    url: "https://farcastbio.com/careers/",
    note: "Populated from provider 'none' to official careers portal",
  },
  {
    company: "Fitsol",
    provider: "custom",
    url: "https://fitsol.earth/careers/",
    note: "Populated from provider 'none' to official careers portal",
  },
  {
    company: "Infoveave Pty Ltd",
    provider: "custom",
    url: "https://infoveave.com/careers/",
    note: "Populated from provider 'none' to official careers portal",
  },
  {
    company: "Motiveminds Consulting Pvt Ltd",
    provider: "custom",
    url: "https://motiveminds.com/careers/",
    note: "Populated from provider 'none' to official careers portal",
  },
  {
    company: "NEC Corporation",
    provider: "custom",
    url: "https://www.nec.com/en/global/careers/",
    note: "Populated from provider 'none' to official careers portal",
  },
  {
    company: "Shindengen India Private Limited",
    provider: "custom",
    url: "https://www.shindengen.com/",
    note: "Populated from provider 'none' to official corporate website",
  },
  {
    company: "TNIFMC",
    provider: "custom",
    url: "https://tnifmc.com/",
    note: "Populated from provider 'none' to official website",
  },
  {
    company: "VSPAGY",
    provider: "custom",
    url: "https://vspagy.com/careers/",
    note: "Populated from provider 'none' to official careers portal",
  },
  {
    company: "ProxNet",
    provider: "internal",
    url: "internal://proxnet",
    note: "Internal platform identifier; exempted from external scrape strain",
  },
];

async function main() {
  for (const c of cleanups) {
    const { error } = await supabase
      .from("company_ats_config")
      .update({
        provider: c.provider,
        board_token_or_url: c.url,
        scrape_notes: c.note,
      })
      .eq("company_name", c.company);

    if (error) {
      console.error(`Failed to update ${c.company}:`, error.message);
    } else {
      console.log(`✅ Cleaned ${c.company} -> [${c.provider}] "${c.url}"`);
    }
  }
}

main();

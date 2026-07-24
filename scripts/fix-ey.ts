import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixEY() {
  const { error } = await supabase
    .from("company_ats_config")
    .update({ 
      provider: "successfactors_sitemap", 
      board_token_or_url: "https://careers.ey.com/sitemap.xml" 
    })
    .eq("company_name", "EY");

  if (error) {
    console.error("Failed to update EY:", error);
  } else {
    console.log("Successfully updated EY to use successfactors_sitemap with https://careers.ey.com/sitemap.xml");
  }
}

fixEY();

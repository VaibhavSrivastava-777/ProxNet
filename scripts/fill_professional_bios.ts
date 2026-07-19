import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiKey = process.env.OPENAI_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Fetching users...");
  const { data: users, error } = await supabase
    .from("users")
    .select("id, full_name, company, job_title, about")
    .not("job_title", "is", null);

  if (error) {
    console.error("Error fetching users:", error);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log("No users found.");
    process.exit(0);
  }

  console.log(`Found ${users.length} users. Generating bios...`);

  for (const user of users) {
    if (!user.company || !user.job_title) {
      console.log(`Skipping ${user.full_name} (${user.id}) - missing company or job title.`);
      continue;
    }

    const prompt = `Write a short, engaging professional bio (max 3 sentences) for a professional who works as a ${user.job_title} at ${user.company}. ${user.about ? `Additional context: ${user.about}` : ''} Keep it third-person and professional. Do NOT mention the person's name anywhere in the bio.`;

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 150,
          temperature: 0.7,
        })
      });

      if (!response.ok) {
        console.error(`Failed to fetch from OpenAI for ${user.id}:`, await response.text());
        continue;
      }

      const data = await response.json();
      const bio = data.choices?.[0]?.message?.content?.trim();
      
      if (bio) {
        const { error: updateError } = await supabase
          .from("users")
          .update({ professional_bio: bio })
          .eq("id", user.id);

        if (updateError) {
          console.error(`Failed to update user ${user.id}:`, updateError);
        } else {
          console.log(`Updated ${user.full_name || user.id}`);
        }
      }
    } catch (err) {
      console.error(`Error generating bio for ${user.id}:`, err);
    }
  }

  console.log("Done.");
}

main();

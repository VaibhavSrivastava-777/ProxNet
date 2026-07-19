import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import OpenAI from "openai";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiKey = process.env.OPENAI_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiKey });

async function main() {
  console.log("Fetching users without a professional_bio...");
  const { data: users, error } = await supabase
    .from("users")
    .select("id, full_name, company, job_title, about")
    .is("professional_bio", null);

  if (error) {
    console.error("Error fetching users:", error);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log("No users found needing a professional_bio.");
    process.exit(0);
  }

  console.log(`Found ${users.length} users. Generating bios...`);

  for (const user of users) {
    if (!user.company || !user.job_title) {
      console.log(`Skipping ${user.full_name} (${user.id}) - missing company or job title.`);
      continue;
    }

    const prompt = `Write a short, engaging professional bio (max 3 sentences) for a professional named ${user.full_name}, who works as a ${user.job_title} at ${user.company}. ${user.about ? `Additional context: ${user.about}` : ''} Keep it third-person and professional.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.7,
      });

      const bio = response.choices[0].message?.content?.trim();
      
      if (bio) {
        const { error: updateError } = await supabase
          .from("users")
          .update({ professional_bio: bio })
          .eq("id", user.id);

        if (updateError) {
          console.error(`Failed to update user ${user.id}:`, updateError);
        } else {
          console.log(`Updated ${user.full_name}`);
        }
      }
    } catch (err) {
      console.error(`Error generating bio for ${user.id}:`, err);
    }
  }

  console.log("Done.");
}

main();

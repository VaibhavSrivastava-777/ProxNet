import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const targetUserId = "50ecc4a2-c514-4922-8eb7-7e74961c7c4f";
  const { data: user } = await supabase
    .from("users")
    .select("profile_digest, resume_text, job_title, company")
    .eq("id", targetUserId)
    .single();

  if (!user || !user.resume_text) {
    console.error("User not found or missing resume");
    return;
  }

  const profileDigest = user.profile_digest || {};
  const evaluatedMatches = profileDigest.evaluated_matches || {};

  const targetJobIds = [
    "185be368-4057-4c7b-ab36-ae51765adc2f", // GTM AI Manager, Sales Analytics @ Zscaler
    "27bb6e21-b1bd-4213-ba2c-67b8c6987a25", // Cloud Solution Architect Manager @ Microsoft
    "b00f3743-2fc9-45f3-bf64-c33dd1404fb6", // Manager, Field Marketing @ Zscaler
    "ff5c5035-2d92-4e38-bb49-5f6efff4f500", // Staff Program Manager, Compliance @ Zscaler
    "c4190e06-02ac-4b03-9120-28ef3f12c268", // Consultant @ Microsoft
  ];

  const { data: jobs } = await supabase.from("scraped_jobs").select("*").in("id", targetJobIds);

  for (const job of jobs || []) {
    const candidateContext = `Candidate: ${user.job_title} @ ${user.company}\nResume: ${(user.resume_text || "").slice(0, 2500)}`;
    const jobContext = `Job: ${job.title} @ ${job.company}\nDescription: ${(job.description || "").slice(0, 1500)}`;

    const prompt = `Evaluate candidate fit for this job (0-100 score). Provide JSON: { "score": number, "reason": "1-2 sentence explanation" }.\n${candidateContext}\n${jobContext}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const parsed = JSON.parse(data.choices[0].message.content);
      const score = Math.round(parsed.score);
      const reason = parsed.reason;
      let label = "Low Match";
      if (score >= 85) label = "Strong Match";
      else if (score >= 70) label = "Good Match";
      else if (score >= 50) label = "Moderate Match";

      evaluatedMatches[job.id] = {
        jobId: job.id,
        score,
        label,
        reason,
        evaluated_at: new Date().toISOString(),
      };
      console.log(`Evaluated ${job.title} @ ${job.company}: ${score}% (${label})`);
    }
  }

  await supabase
    .from("users")
    .update({
      profile_digest: {
        ...profileDigest,
        evaluated_matches: evaluatedMatches,
      },
    })
    .eq("id", targetUserId);

  console.log("Updated user profile_digest with evaluated matches.");
}

run();

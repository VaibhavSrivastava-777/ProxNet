import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_KEY) return NextResponse.json({ error: "Missing OpenAI Key" }, { status: 500 });

  const { data: users, error } = await supabase
    .from("users")
    .select("id, full_name, company, job_title, about, resume_text")
    .is("embedding", null)
    .eq("is_active", true);

  if (error || !users) return NextResponse.json({ error: "Error fetching users" }, { status: 500 });

  let successCount = 0;

  for (const user of users) {
    const denseContext = user.resume_text ? `Resume: ${user.resume_text}` : `About: ${user.about || "None"}`;
    const textToEmbed = `Company: ${user.company || "None"}\nRole: ${user.job_title || "None"}\n${denseContext}`.slice(0, 8000);

    try {
      const oaiRes = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ input: textToEmbed, model: "text-embedding-3-small" })
      });

      if (oaiRes.ok) {
        const oaiData = await oaiRes.json();
        const embedding = oaiData.data?.[0]?.embedding;
        if (embedding) {
          const { error: updateError } = await supabase.from("users").update({ embedding }).eq("id", user.id);
          if (!updateError) successCount++;
        }
      }
    } catch (e) {
      console.error("Backfill failed for", user.id, e);
    }
  }

  return NextResponse.json({ success: true, count: successCount, total: users.length });
}

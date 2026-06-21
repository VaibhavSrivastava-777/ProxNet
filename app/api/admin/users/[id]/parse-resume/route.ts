import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";
// @ts-ignore
import PDFParser from "pdf2json";
import { normalizeLinkedInUrl } from "@/lib/linkedin/normalize-url";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();

  // Ensure user exists
  const { data: user, error: userError } = await supabase.from("users").select("id").eq("id", id).single();
  if (userError || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });

    // 1. Extract text using pdf2json
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const extractedText = await new Promise<string>((resolve, reject) => {
      const pdfParser = new PDFParser(null, 1 as any);
      pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
      pdfParser.on("pdfParser_dataReady", () => {
        resolve(pdfParser.getRawTextContent());
      });
      pdfParser.parseBuffer(buffer);
    });

    if (!extractedText || extractedText.trim() === "") {
       throw new Error("Could not extract any text from the PDF.");
    }

    // 2. Upload to Supabase using admin client
    const fileName = `${id}-${Date.now()}.pdf`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(fileName, buffer, { contentType: "application/pdf" });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from("resumes").getPublicUrl(fileName);
    const resume_url = publicUrlData.publicUrl;

    // 3. Extract fields via OpenAI (skip name and email)
    // 4. Prepare updates for the user record
    const updates: any = {
      resume_text: extractedText,
      resume_url,
      updated_at: new Date().toISOString()
    };

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (OPENAI_KEY) {
      try {
        const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { 
                role: "system", 
                content: `You are an expert HR data extractor. Extract the user's most recent company, job title, LinkedIn URL (if present), and create a compelling professional 2-3 sentence 'about' summary.
Output valid JSON ONLY. Format:
{
  "company": "string (empty if none)",
  "job_title": "string (empty if none)",
  "about": "string (empty if none)",
  "linkedin_profile_url": "string (empty if none)"
}
Do NOT include full_name or email. Return only the raw JSON object, no markdown blocks.` 
              },
              { role: "user", content: extractedText.slice(0, 8000) }
            ],
            temperature: 0.1
          })
        });
        
        if (oaiRes.ok) {
          const oaiData = await oaiRes.json();
          let content = oaiData.choices[0].message.content.trim();
          if (content.startsWith("```json")) {
            content = content.replace(/^```json\n?/, "").replace(/\n?```$/, "");
          } else if (content.startsWith("```")) {
            content = content.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "");
          }
          const parsed = JSON.parse(content);
          
          if (parsed.company) updates.company = parsed.company;
          if (parsed.job_title) updates.job_title = parsed.job_title;
          if (parsed.about) updates.about = parsed.about;
          if (parsed.linkedin_profile_url) {
            const norm = normalizeLinkedInUrl(parsed.linkedin_profile_url);
            if (norm) updates.linkedin_profile_url = norm;
          }
        }
      } catch (e) {
        console.error("Failed to extract details via OpenAI", e);
      }

      // Generate embedding
      const denseContext = extractedText ? `Resume: ${extractedText}` : `About: ${updates.about || "None"}`;
      const textToEmbed = `Company: ${updates.company || "None"}\nRole: ${updates.job_title || "None"}\n${denseContext}`.slice(0, 8000);
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
            updates.embedding = embedding;
          }
        }
      } catch (e) {
        console.error("Failed to generate embedding", e);
      }
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      user: updatedUser
    });
  } catch (error: any) {
    console.error("Admin parse resume error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

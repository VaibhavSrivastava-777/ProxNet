import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
// @ts-ignore
import PDFParser from "pdf2json";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    // 2. Upload to Supabase using admin client (bypasses RLS)
    const supabase = createAdminClient();
    const fileName = `${user.id}-${Date.now()}.pdf`;
    
    const { data, error } = await supabase.storage
      .from("resumes")
      .upload(fileName, buffer, { contentType: "application/pdf" });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage.from("resumes").getPublicUrl(fileName);

    // 3. Extract details via OpenAI
    let company = "";
    let job_title = "";
    let about = "";
    let phone_number = "";
    
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
                content: `You are an expert HR data extractor. Extract the user's most recent company, job title, phone number (if present, keep only digits and clean formatting), and create a compelling professional 2-3 sentence 'about' summary.
Output valid JSON ONLY. Format:
{
  "company": "string (empty if none)",
  "job_title": "string (empty if none)",
  "phone_number": "string (empty if none)",
  "about": "string (empty if none)"
}
Return only the raw JSON object, no markdown blocks.`
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
          if (parsed.company) company = parsed.company;
          if (parsed.job_title) job_title = parsed.job_title;
          if (parsed.phone_number) phone_number = parsed.phone_number;
          if (parsed.about) about = parsed.about;
        }
      } catch (e) {
        console.error("Failed to summarize about and extract job details", e);
      }
    }

    return NextResponse.json({
      resume_url: publicUrlData.publicUrl,
      resume_text: extractedText,
      about,
      company,
      job_title,
      phone_number
    });
  } catch (error: any) {
    console.error("Parse resume error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


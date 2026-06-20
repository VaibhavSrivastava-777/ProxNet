import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
// @ts-ignore
import PDFParser from "pdf2json";

export const dynamic = "force-dynamic";

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

    // 3. Generate "About" summary
    let about = "";
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
              { role: "system", content: "You are an expert career coach. Summarize the user's resume into a compelling, professional 2-3 sentence 'About' summary that highlights their core skills and experience. Do not exceed 3 sentences." },
              { role: "user", content: extractedText.slice(0, 8000) }
            ],
            temperature: 0.7
          })
        });
        if (oaiRes.ok) {
          const oaiData = await oaiRes.json();
          about = oaiData.choices[0].message.content;
        }
      } catch (e) {
        console.error("Failed to summarize about", e);
      }
    }

    return NextResponse.json({
      resume_url: publicUrlData.publicUrl,
      resume_text: extractedText,
      about
    });
  } catch (error: any) {
    console.error("Parse resume error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


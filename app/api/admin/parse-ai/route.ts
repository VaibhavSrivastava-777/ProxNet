import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";

export async function POST(request: Request) {
  // 1. Authenticate admin
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Validate API key presence
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Anthropic API key is not configured in environment variables." },
      { status: 500 }
    );
  }

  try {
    const { text, image } = await request.json();

    if (!text && !image) {
      return NextResponse.json(
        { error: "Please provide either text content or an image to parse." },
        { status: 400 }
      );
    }

    const content: any[] = [];

    // Process image if provided (vision model input)
    if (image) {
      let mediaType = "image/png";
      let base64Data = "";

      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mediaType = match[1];
        base64Data = match[2];
      } else {
        base64Data = image;
      }

      // Keep only allowed media types for Anthropic Messages API
      const allowedMediaTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedMediaTypes.includes(mediaType)) {
        if (mediaType.includes("jpg") || mediaType.includes("jpeg")) {
          mediaType = "image/jpeg";
        } else if (mediaType.includes("webp")) {
          mediaType = "image/webp";
        } else if (mediaType.includes("gif")) {
          mediaType = "image/gif";
        } else {
          mediaType = "image/png"; // fallback
        }
      }

      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: base64Data,
        },
      });
    }

    // Prepare prompt
    const promptText = `Extract professional profile information from the provided ${
      image ? "screenshot or resume image" : "text/HTML"
    }.
Output a valid JSON object matching this schema:
{
  "full_name": string (required, default to ""),
  "email": string (optional, default to ""),
  "company": string (optional, default to ""),
  "job_title": string (optional, default to ""),
  "profile_photo_url": string (optional, default to ""),
  "linkedin_profile_url": string (optional, default to "")
}

Rules:
1. Extract full_name, email, company, job_title, profile_photo_url, and linkedin_profile_url if present.
2. If a field cannot be found, leave it as an empty string "".
3. Return ONLY the JSON object. Do not include markdown code block formatting (e.g. no \`\`\`json). Do not add any introductory or explaining text.
4. Output valid, clean JSON.`;

    if (text) {
      content.push({
        type: "text",
        text: `${promptText}\n\nInput content to extract from:\n${text}`,
      });
    } else {
      content.push({
        type: "text",
        text: promptText,
      });
    }

    // Call Anthropic API
    let modelName = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
    let response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: content,
          },
        ],
      }),
      next: { revalidate: 0 },
    });

    // Fallback if model is not found (404) or similar model error
    if (response.status === 404 && !process.env.ANTHROPIC_MODEL && modelName === "claude-haiku-4-5-20251001") {
      console.warn("Model claude-haiku-4-5-20251001 returned 404. Trying fallback model claude-sonnet-4-6...");
      modelName = "claude-sonnet-4-6";
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: content,
            },
          ],
        }),
        next: { revalidate: 0 },
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error response:", errorText);
      return NextResponse.json(
        { error: `Anthropic API error: ${response.statusText} (${response.status}). Model tried: ${modelName}` },
        { status: 502 }
      );
    }

    const result = await response.json();
    let textOut = result.content?.[0]?.text || "";

    // Parse the output robustly
    textOut = textOut.trim();
    if (textOut.startsWith("```")) {
      textOut = textOut.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "");
    }
    textOut = textOut.trim();

    try {
      const parsedData = JSON.parse(textOut);
      return NextResponse.json(parsedData);
    } catch (parseError) {
      console.error("Failed to parse JSON from Claude response:", textOut, parseError);
      return NextResponse.json(
        { error: "AI response did not contain valid JSON format.", raw: textOut },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("AI parse route error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process profile data." },
      { status: 500 }
    );
  }
}

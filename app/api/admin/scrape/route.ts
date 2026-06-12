import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url || !url.includes("linkedin.com")) {
      return NextResponse.json({ error: "Invalid LinkedIn URL" }, { status: 400 });
    }

    // Try fetching the public profile page
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      next: { revalidate: 0 },
    });

    const html = await res.text();

    // Extract title
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    let title = titleMatch ? titleMatch[1] : "";

    const ogTitleMatch = html.match(/<meta property="og:title" content="(.*?)"/i);
    if (ogTitleMatch) title = ogTitleMatch[1];

    title = title
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&ndash;/g, "-")
      .replace(/&mdash;/g, "-");

    title = title.replace(/\s*\|\s*LinkedIn\s*$/i, "");

    const parts = title.split(" - ");
    let full_name = "";
    let job_title = "";
    let company = "";

    if (parts.length >= 3) {
      full_name = parts[0].trim();
      job_title = parts[1].trim();
      company = parts.slice(2).join(" - ").trim();
    } else if (parts.length === 2) {
      full_name = parts[0].trim();
      company = parts[1].trim();
    } else {
      full_name = parts[0].trim();
    }

    return NextResponse.json({ full_name, job_title, company });
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json({ error: "Failed to scrape profile" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { parseLinkedInProfile } from "@/lib/linkedin/parse-profile";

export async function POST(request: Request) {
  try {
    const adminSession = await getAdminSession();
    if (!adminSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url } = await request.json();
    if (!url || !url.includes("linkedin.com")) {
      return NextResponse.json({ error: "Invalid LinkedIn URL" }, { status: 400 });
    }

    const result = await parseLinkedInProfile(url);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || "Could not extract data. LinkedIn may have blocked the request." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      full_name: result.data.full_name || "",
      company: result.data.company || "",
      job_title: result.data.job_title || "",
      about: result.data.about || result.data.professional_bio || "",
      professional_bio: result.data.professional_bio || "",
      data: result.data,
    });
  } catch (error: any) {
    console.error("[admin/scrape] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to scrape profile" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { parseLinkedInProfile } from "@/lib/linkedin/parse-profile";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url") || "";

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const result = await parseLinkedInProfile(url);

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error || "Failed to parse LinkedIn URL" }, { status: 500 });
  }

  return NextResponse.json(result);
}

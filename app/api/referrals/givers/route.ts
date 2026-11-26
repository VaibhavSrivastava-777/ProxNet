export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getCompanyMembers } from "@/lib/referrals";

/** Professionals at a company who can give a referral (excludes the caller). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = new URL(request.url).searchParams.get("company") ?? "";
  if (!company.trim()) return NextResponse.json({ error: "company is required" }, { status: 400 });

  const members = await getCompanyMembers(company, user.id);
  return NextResponse.json({
    givers: members.map((m) => ({
      id: m.id,
      name: m.full_name || "Professional",
      title: m.job_title || null,
      photo: m.profile_photo_url || null,
    })),
  });
}

import { connection } from "next/server";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getCompanyDirectory } from "@/lib/referrals";

export async function GET() {
  await connection();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companies = await getCompanyDirectory();
  return NextResponse.json({ companies });
}

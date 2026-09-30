import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: userData } = await supabase
    .from("users")
    .select("profile_digest")
    .eq("id", user.id)
    .single();

  const watchedCompanies = userData?.profile_digest?.watched_pioneer_companies || [];
  return NextResponse.json({ watchedCompanies });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { company } = await request.json();
  if (!company) return NextResponse.json({ error: "Company is required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: userData, error } = await supabase
    .from("users")
    .select("profile_digest")
    .eq("id", user.id)
    .single();

  if (error || !userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const currentDigest = userData.profile_digest || {};
  const watchedCompanies: string[] = currentDigest.watched_pioneer_companies || [];

  let updatedList: string[];
  let isWatching: boolean;

  if (watchedCompanies.includes(company)) {
    updatedList = watchedCompanies.filter((c) => c !== company);
    isWatching = false;
  } else {
    updatedList = [...watchedCompanies, company];
    isWatching = true;
  }

  await supabase
    .from("users")
    .update({
      profile_digest: {
        ...currentDigest,
        watched_pioneer_companies: updatedList,
      },
    })
    .eq("id", user.id);

  return NextResponse.json({
    success: true,
    isWatching,
    watchedCompanies: updatedList,
  });
}

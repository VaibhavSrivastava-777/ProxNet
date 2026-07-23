import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: users, error } = await supabase.from("users").select("id, full_name, email, company, job_title").eq("is_active", true);

  if (error || !users) return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });

  let sent = 0;
  const emailsToRemind: string[] = [];

  for (const u of users) {
    if (!u.full_name?.trim() || !u.email?.trim() || !u.company?.trim() || !u.job_title?.trim()) {
      if (u.email) emailsToRemind.push(u.email);
      await sendNotification(u.id, {
        title: "Complete your profile",
        body: "Please complete your profile by adding your name, email, designation, and company name to unlock full access.",
        url: "/profile"
      });
      sent++;
    }
  }

  return NextResponse.json({ success: true, sent, emails: emailsToRemind });
}

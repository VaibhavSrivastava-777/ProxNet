import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: users, error } = await supabase.from("users").select("id, email, company, job_title, home_lat, office_lat").eq("is_active", true);

  if (error || !users) return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });

  let sent = 0;
  const emailsToRemind: string[] = [];

  for (const u of users) {
    if (!u.company || !u.job_title || (!u.home_lat && !u.office_lat)) {
      if (u.email) emailsToRemind.push(u.email);
      await sendNotification(u.id, {
        title: "Complete your profile",
        body: "Add your company, job title, and location information. Unless location information is provided, you won't appear on the proximity map network!",
        url: "/profile"
      });
      sent++;
    }
  }

  return NextResponse.json({ success: true, sent, emails: emailsToRemind });
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase.from('users').select('id, email').eq('email', email).single();
  
  if (error || !data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await sendNotification(data.id, {
    title: "Test PWA Notification",
    body: "This is a test notification to verify your PWA push delivery is working!",
    url: "/"
  });

  return NextResponse.json({ success: true, userId: data.id });
}

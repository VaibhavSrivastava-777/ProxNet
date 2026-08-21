import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  const type = url.searchParams.get("type") || "all";

  if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase.from('users').select('id, email').eq('email', email).single();
  
  if (error || !data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const dispatched: any[] = [];

  if (type === "job_match" || type === "all") {
    await sendNotification(data.id, {
      title: "🔥 96% Match Found: Enterprise Account Manager @ Paytm",
      body: "A new high-match role matching your resume was analyzed and ready for referral!",
      url: "/jobs",
      data: { type: "job_match", matchRate: 96 }
    });
    dispatched.push({ type: "job_match", title: "🔥 96% Match Found: Enterprise Account Manager @ Paytm" });
  }

  if (type === "message" || type === "all") {
    await sendNotification(data.id, {
      title: "🤝 New Referral Message from Product Manager @ Google",
      body: "Hey Vaibhav! I reviewed your profile digest and would be glad to submit a referral for you.",
      url: "/qa?tab=network",
      data: { type: "message" }
    });
    dispatched.push({ type: "message", title: "🤝 New Referral Message from Product Manager @ Google" });
  }

  return NextResponse.json({ success: true, userId: data.id, dispatched });
}

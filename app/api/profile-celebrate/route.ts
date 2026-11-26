import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { targetId, graffitiNote } = body;

    if (!targetId || typeof targetId !== "string") {
      return NextResponse.json({ error: "targetId is required" }, { status: 400 });
    }

    if (targetId === user.id) {
      return NextResponse.json({ error: "You cannot celebrate your own profile" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Fetch target user info
    const { data: targetUser, error: targetError } = await supabase
      .from("users")
      .select("id, full_name, anonymous_name, company, job_title")
      .eq("id", targetId)
      .maybeSingle();

    if (targetError) {
      console.warn("[profile-celebrate] Could not fetch target user:", targetError.message);
    }

    const celebratorName = user.full_name || user.anonymous_name || "A professional neighbor";
    const celebratorCompany = user.company ? ` @ ${user.company}` : "";

    // 2. Trigger notification to target user
    const defaultNote = "celebrated your professional profile!";
    const noteText = graffitiNote ? `celebrated you: "${graffitiNote}"` : defaultNote;

    await sendNotification(targetId, {
      title: "Profile Celebrated! 🎉",
      body: `${celebratorName}${celebratorCompany} ${noteText}`,
      url: `/qa?tab=network`,
      data: {
        type: "profile_celebrated",
        celebratorId: user.id,
        celebratorName,
        celebratorCompany: user.company || "",
      },
    }).catch((err) => {
      console.error("[profile-celebrate] Notification dispatch failed:", err);
    });

    return NextResponse.json({
      success: true,
      celebratedUser: targetUser?.full_name || targetUser?.anonymous_name || "Neighbor",
      message: `You celebrated ${targetUser?.full_name || "this profile"}!`,
    });
  } catch (err: any) {
    console.error("[profile-celebrate] Unexpected error:", err);
    return NextResponse.json({ error: err.message || "Failed to celebrate profile" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  const { data: interactions, error } = await supabase
    .from("profile_likes")
    .select("target_id, action, created_at")
    .eq("liker_id", user.id);

  if (error) {
    console.warn("[profile-likes] Warning fetching interactions (table may need migration):", error.message);
    return NextResponse.json({
      interactedIds: [],
      likesMap: {},
      warning: error.message,
    });
  }

  const interactedIds = (interactions || []).map((row) => row.target_id);
  const likesMap: Record<string, "like" | "skip"> = {};
  for (const item of interactions || []) {
    likesMap[item.target_id] = item.action as "like" | "skip";
  }

  return NextResponse.json({
    interactedIds,
    likesMap,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { targetId, action } = body;

    if (!targetId || typeof targetId !== "string") {
      return NextResponse.json({ error: "targetId is required" }, { status: 400 });
    }

    if (targetId === user.id) {
      return NextResponse.json({ error: "You cannot like/skip yourself" }, { status: 400 });
    }

    if (action !== "like" && action !== "skip") {
      return NextResponse.json({ error: "Action must be 'like' or 'skip'" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Upsert interaction
    const { error: upsertError } = await supabase
      .from("profile_likes")
      .upsert(
        {
          liker_id: user.id,
          target_id: targetId,
          action,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "liker_id,target_id" }
      );

    if (upsertError) {
      console.error("[profile-likes] Upsert error:", upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    let isMutualMatch = false;
    let targetSummary: { id: string; name: string; company?: string; job_title?: string; photo_url?: string } | null = null;

    // 2. Check for mutual match if action is 'like'
    if (action === "like") {
      const { data: reverseLike, error: reverseError } = await supabase
        .from("profile_likes")
        .select("id, action")
        .eq("liker_id", targetId)
        .eq("target_id", user.id)
        .eq("action", "like")
        .maybeSingle();

      if (reverseError) {
        console.warn("[profile-likes] Error checking mutual match:", reverseError);
      }

      if (reverseLike) {
        isMutualMatch = true;

        // Fetch target user details for notification
        const { data: targetUser } = await supabase
          .from("users")
          .select("id, full_name, anonymous_name, company, job_title, profile_photo_url")
          .eq("id", targetId)
          .maybeSingle();

        const currentUserName = user.full_name || user.anonymous_name || "A neighbour";
        const currentUserCompany = user.company ? ` @ ${user.company}` : "";

        const targetUserName = targetUser?.full_name || targetUser?.anonymous_name || "A neighbour";
        const targetUserCompany = targetUser?.company ? ` @ ${targetUser.company}` : "";

        if (targetUser) {
          targetSummary = {
            id: targetUser.id,
            name: targetUserName,
            company: targetUser.company || undefined,
            job_title: targetUser.job_title || undefined,
            photo_url: targetUser.profile_photo_url || undefined,
          };
        }

        // Notify target user
        sendNotification(targetId, {
          title: "It's a Match! 🎉",
          body: `${currentUserName}${currentUserCompany} also wants to connect with you! Tap to say hello.`,
          url: `/qa?tab=network&match=${encodeURIComponent(user.id)}`,
          data: {
            type: "mutual_like_match",
            matchedUserId: user.id,
            matchedUserName: currentUserName,
          },
        }).catch((err) => console.error("[profile-likes] Notification to target failed:", err));

        // Notify current user (in-app alert / push confirmation)
        sendNotification(user.id, {
          title: "It's a Match! 🎉",
          body: `You and ${targetUserName}${targetUserCompany} both showed interest in connecting!`,
          url: `/qa?tab=network&match=${encodeURIComponent(targetId)}`,
          data: {
            type: "mutual_like_match",
            matchedUserId: targetId,
            matchedUserName: targetUserName,
          },
        }).catch((err) => console.error("[profile-likes] Notification to current user failed:", err));
      }
    }

    return NextResponse.json({
      success: true,
      action,
      isMutualMatch,
      targetUser: targetSummary,
    });
  } catch (err: any) {
    console.error("[profile-likes] Unexpected error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

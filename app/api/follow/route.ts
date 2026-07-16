import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  // Get following count and ids
  const { data: following, error: errFollowing } = await supabase
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", user.id);

  if (errFollowing) return NextResponse.json({ error: errFollowing.message }, { status: 500 });

  const followingIds = (following ?? []).map((f) => f.following_id);

  // Get follower count
  const { count: followerCount, error: errFollowers } = await supabase
    .from("user_follows")
    .select("id", { count: "exact", head: true })
    .eq("following_id", user.id);

  if (errFollowers) return NextResponse.json({ error: errFollowers.message }, { status: 500 });

  return NextResponse.json({
    followerCount: followerCount || 0,
    followingCount: followingIds.length,
    followingIds,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { targetUserId } = body;

  if (!targetUserId) {
    return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
  }

  if (targetUserId === user.id) {
    return NextResponse.json({ error: "You cannot follow yourself" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Check if already following
  const { data: existing, error: errExist } = await supabase
    .from("user_follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId)
    .maybeSingle();

  if (errExist) return NextResponse.json({ error: errExist.message }, { status: 500 });

  if (existing) {
    // Unfollow
    const { error: errDel } = await supabase
      .from("user_follows")
      .delete()
      .eq("id", existing.id);

    if (errDel) return NextResponse.json({ error: errDel.message }, { status: 500 });
    return NextResponse.json({ followed: false });
  } else {
    // Follow
    const { error: errIns } = await supabase
      .from("user_follows")
      .insert({
        follower_id: user.id,
        following_id: targetUserId,
      });

    if (errIns) return NextResponse.json({ error: errIns.message }, { status: 500 });

    // Send follower notification
    const followerName = user.anonymous_name || "A neighbor";
    sendNotification(targetUserId, {
      title: "New Follower",
      body: `${followerName} is now following you.`,
      url: "/profile",
    }).catch((e) => console.error("Failed to send follow notification:", e));

    return NextResponse.json({ followed: true });
  }
}

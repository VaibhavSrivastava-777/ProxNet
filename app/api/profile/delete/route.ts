import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;
  const supabase = createAdminClient();

  try {
    // Clean up dependencies in sequence to handle foreign key references
    await supabase.from("fcm_tokens").delete().eq("user_id", userId);
    await supabase.from("user_follows").delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`);
    await supabase.from("referral_relationships").delete().or(`inviter_id.eq.${userId},invitee_id.eq.${userId}`);
    await supabase.from("points_log").delete().eq("user_id", userId);
    await supabase.from("in_app_notifications").delete().eq("user_id", userId);
    await supabase.from("question_likes").delete().eq("user_id", userId);
    await supabase.from("question_comments").delete().eq("user_id", userId);
    await supabase.from("chat_messages").delete().eq("sender_id", userId);
    await supabase.from("chat_participants").delete().eq("user_id", userId);
    await supabase.from("question_targets").delete().eq("professional_id", userId);
    await supabase.from("questions").delete().eq("asker_id", userId);
    await supabase.from("carpool_posts").delete().eq("user_id", userId);
    await supabase.from("job_posts").delete().eq("user_id", userId);
    await supabase.from("user_current_locations").delete().eq("user_id", userId);

    const { error: deleteError } = await supabase.from("users").delete().eq("id", userId);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Account deletion failed:", error);
    return NextResponse.json({ error: error.message || "Failed to delete account" }, { status: 500 });
  }
}

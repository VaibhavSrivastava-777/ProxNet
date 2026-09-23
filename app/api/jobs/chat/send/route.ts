import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";
import { awardWalletCredits, transferCredits } from "@/lib/wallet";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId, body } = await request.json();
  if (!threadId || !body) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const supabase = createAdminClient();

  // Validate participation
  const { data: participant } = await supabase
    .from("job_participants")
    .select("alias")
    .eq("thread_id", threadId)
    .eq("user_id", user.id)
    .single();

  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Insert message
  const { data: msg, error } = await supabase
    .from("job_messages")
    .insert({
      thread_id: threadId,
      sender_id: user.id,
      body: body.trim()
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get other participant to notify & transfer from
  const { data: others } = await supabase
    .from("job_participants")
    .select("user_id")
    .eq("thread_id", threadId)
    .neq("user_id", user.id);

  // Check if this is the user's first response to someone else's referral ask
  let creditReward: { creditsAwarded: number; newBalance: number; message?: string } | null = null;
  const { count: userMsgCount } = await supabase
    .from("job_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", threadId)
    .eq("sender_id", user.id);

  if (userMsgCount === 1) {
    const { count: priorMsgCount } = await supabase
      .from("job_messages")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", threadId)
      .neq("sender_id", user.id);

    if (priorMsgCount && priorMsgCount > 0) {
      const requesterId = others?.[0]?.user_id;
      if (requesterId) {
        const transferRes = await transferCredits(requesterId, user.id, 3, "referral_response_transfer", threadId);
        if (transferRes.success) {
          creditReward = {
            creditsAwarded: 3,
            newBalance: transferRes.toBalance,
            message: "+3 credits transferred from requester for responding to referral ask!",
          };
        }
      } else {
        creditReward = await awardWalletCredits(user.id, "responded_referral_ask", threadId);
      }
    }
  }

  if (others && others.length > 0) {
    const targetUserId = others[0].user_id;
    try {
      await sendNotification(targetUserId, {
        title: `New Message from ${participant.alias}`,
        body: body.length > 80 ? body.substring(0, 80) + "..." : body,
        url: `/jobs/chat/${threadId}`,
        data: {
          threadId,
          type: "chat_message",
          soundType: "message",
          sound: "default",
          senderAlias: participant.alias
        }
      });
    } catch (e) {
      console.error("Failed to send notification", e);
    }
  }

  return NextResponse.json({
    message: msg,
    creditsAwarded: creditReward?.creditsAwarded || 0,
    newBalance: creditReward?.newBalance,
    rewardMessage: creditReward?.message,
  });
}

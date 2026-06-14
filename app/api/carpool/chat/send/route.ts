import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId, body } = await request.json();
  if (!threadId || !body) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const supabase = createAdminClient();

  // 1. Verify user is in thread
  const { data: participant } = await supabase
    .from("carpool_participants")
    .select("alias")
    .eq("thread_id", threadId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!participant) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  // 2. Insert message
  const { error: msgError } = await supabase
    .from("carpool_messages")
    .insert({
      thread_id: threadId,
      sender_id: user.id,
      body,
    });

  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });

  // 2b. Send Push Notification to the other participant
  const { data: otherParticipant } = await supabase
    .from("carpool_participants")
    .select("user_id")
    .eq("thread_id", threadId)
    .neq("user_id", user.id)
    .maybeSingle();

  if (otherParticipant) {
    await sendNotification(otherParticipant.user_id, {
      title: `New Message from ${participant.alias}`,
      body,
      url: `/carpool/chat/${threadId}`,
      data: {
        sound: "/car-honk.mp3"
      }
    });
  }

  // 3. Check Thread Status
  const { data: thread } = await supabase
    .from("carpool_threads")
    .select("status")
    .eq("id", threadId)
    .single();

  if (thread?.status === "active") {
    // 4. Trigger AI classification
    // Get last 10 messages
    const { data: history } = await supabase
      .from("carpool_messages")
      .select("body, sender_id")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (history && history.length >= 1) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (apiKey) {
        // Format history
        const formattedHistory = history.reverse().map(m => 
          `${m.sender_id === user.id ? 'UserA' : 'UserB'}: ${m.body}`
        ).join("\n");

        const prompt = `Classify whether both parties have mutually agreed on terms (e.g. pickup time/location) and are ready to suggest exchanging contact numbers (a handshake). Even if the conversation is short, if an agreement is evident, mark ready as true.
Respond ONLY with JSON matching this schema exactly: {"ready": true|false, "confidence": 0-100}

Recent conversation:
${formattedHistory}`;

        try {
          const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-6",
              max_tokens: 200,
              messages: [{ role: "user", content: prompt }],
            }),
          });

          if (aiResponse.ok) {
            const result = await aiResponse.json();
            let textOut = result.content?.[0]?.text || "";
            textOut = textOut.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
            const parsed = JSON.parse(textOut);

            if (parsed.ready === true && parsed.confidence > 70) {
              await supabase
                .from("carpool_threads")
                .update({ status: "reveal_pending" })
                .eq("id", threadId);
            }
          }
        } catch (e) {
          console.error("AI trigger failed", e);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

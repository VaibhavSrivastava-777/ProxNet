import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";

// Helper to ensure AI user and Chat Session exist
export async function getOrCreateAISession(supabase: any, userId: string) {
  // 1. Get or Create AI User
  let { data: aiUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", "ai@proxnet.in")
    .maybeSingle();

  if (!aiUser) {
    const { data: newUser } = await supabase
      .from("users")
      .insert({
        email: "ai@proxnet.in",
        full_name: "ProxNet AI",
        job_title: "Network Assistant",
        company: "ProxNet",
        source: "admin",
        is_active: true,
        visibility: { showCompany: true, showTitle: true, showPhoto: true },
      })
      .select("id")
      .single();
    aiUser = newUser;
  }
  const aiUserId = aiUser.id;

  // 2. Check if a session exists between user and AI
  // We look for a session where question_id is null and participants include BOTH user and AI
  const { data: sessions } = await supabase
    .from("chat_participants")
    .select("session_id")
    .eq("user_id", userId);

  let sessionId = null;
  if (sessions && sessions.length > 0) {
    const sessionIds = sessions.map((s: any) => s.session_id);
    const { data: aiParticipants } = await supabase
      .from("chat_participants")
      .select("session_id")
      .eq("user_id", aiUserId)
      .in("session_id", sessionIds);
    if (aiParticipants && aiParticipants.length > 0) {
      sessionId = aiParticipants[0].session_id;
    }
  }

  if (!sessionId) {
    // Create new session
    const { data: newSession } = await supabase
      .from("chat_sessions")
      .insert({})
      .select("id")
      .single();
    sessionId = newSession.id;
    await supabase.from("chat_participants").insert([
      { session_id: sessionId, user_id: userId, alias: "Resident" },
      { session_id: sessionId, user_id: aiUserId, alias: "ProxNet AI" },
    ]);
  }

  return { sessionId, aiUserId };
}

export async function initiateWelcomeMessage(userId: string) {
  const supabase = createAdminClient();
  const { sessionId, aiUserId } = await getOrCreateAISession(supabase, userId);

  // Check if there are already messages in this session
  const { data: existingMessages } = await supabase
    .from("chat_messages")
    .select("id")
    .eq("session_id", sessionId)
    .limit(1);

  if (existingMessages && existingMessages.length > 0) {
    // Session already has messages, do not send welcome message again.
    return;
  }

  const welcomeText = `Hello! I'm ProxNet AI, your hyper-local professional networking assistant. 🤖

I'm here to help you connect with professionals around you. You can ask me questions to find people nearby based on their company, domain, or role!

**Examples of what you can ask me:**
- *"Anyone from Amazon?"*
- *"Anyone from the banking domain?"*
- *"Can you find me a product manager nearby?"*
- *"Are there any software engineers working at Microsoft?"*

**Here's what you can explore in ProxNet:**
- **Proximity:** See where professionals live and work around you on the map.
- **Chat:** Talk directly with people or me (ProxNet AI) to get introductions.
- **Forum:** Engage in hyper-local discussions, ask for recommendations, or share updates with your neighborhood.
- **Grow:** Track your connections and expand your local professional network.

How can I help you today?`;

  // Insert the welcome message
  const { error } = await supabase.from("chat_messages").insert({
    session_id: sessionId,
    sender_id: aiUserId,
    body: welcomeText,
  });

  if (error) {
    console.error("Failed to insert welcome message:", error);
    return;
  }

  // Fire an FCM notification for this message
  await sendNotification(userId, {
    title: "ProxNet AI",
    body: "Hello! I'm ProxNet AI, your hyper-local professional networking assistant...",
    url: `/chat/${sessionId}`,
  });
}

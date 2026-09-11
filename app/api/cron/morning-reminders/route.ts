import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";
import { getAdminSession } from "@/lib/admin-session";

export const maxDuration = 60;

export async function GET(request: Request) {
  return handleMorningReminders(request);
}

export async function POST(request: Request) {
  return handleMorningReminders(request);
}

async function handleMorningReminders(request: Request) {
  // Authorization check (Vercel Cron Secret, Admin Session, or ?secret= param)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
  const adminSession = await getAdminSession();
  const url = new URL(request.url);
  const secretParam = url.searchParams.get("secret");
  const isParamAuth = !!cronSecret && secretParam === cronSecret;

  if (!isCron && !adminSession && !isParamAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = Date.now();
  const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  let profileRemindersSent = 0;
  let starterRemindersSent = 0;
  const auditLog: Array<{ type: string; userId: string; title: string; url: string }> = [];

  // =========================================================================
  // 1. INCOMPLETE PROFILES REMINDERS
  // =========================================================================
  try {
    const { data: activeUsers, error: usersErr } = await supabase
      .from("users")
      .select("id, email, full_name, company, job_title, home_lat, office_lat")
      .eq("is_active", true)
      .eq("is_blocked", false);

    if (!usersErr && activeUsers) {
      // Find users with incomplete profiles (missing name, title, company, or location)
      const incompleteUsers = activeUsers.filter((u) => {
        const hasName = Boolean(u.full_name?.trim());
        const hasTitle = Boolean(u.job_title?.trim());
        const hasCompany = Boolean(u.company?.trim());
        const hasLocation = Boolean(u.home_lat || u.office_lat);
        return !hasName || !hasTitle || !hasCompany || !hasLocation;
      });

      // Find users who already received a profile reminder in the last 24 hours
      const { data: recentProfileNotifs } = await supabase
        .from("in_app_notifications")
        .select("user_id")
        .eq("url", "/profile")
        .gte("created_at", twentyFourHoursAgo);

      const recentlyRemindedProfiles = new Set((recentProfileNotifs || []).map((n) => n.user_id));

      for (const u of incompleteUsers) {
        if (recentlyRemindedProfiles.has(u.id)) continue;

        try {
          const title = "📝 Complete your ProxNet profile";
          const body = "Add your designation, company, and location to get discovered by professional neighbors and unlock full access!";
          const targetUrl = "/profile";

          await sendNotification(u.id, {
            title,
            body,
            url: targetUrl,
            data: {
              type: "profile_reminder",
              soundType: "notification",
              sound: "default",
            },
          });

          profileRemindersSent++;
          auditLog.push({ type: "profile_reminder", userId: u.id, title, url: targetUrl });
        } catch (err) {
          console.warn(`Failed to send profile reminder to ${u.id}:`, err);
        }
      }
    }
  } catch (profileErr) {
    console.error("Error processing incomplete profile reminders:", profileErr);
  }

  // =========================================================================
  // 2. UNRESPONDED INITIAL OPENING MESSAGES (>24h)
  // "Limit this reminder notifications only for not responded to initial opening message.
  // Key is to remind users to have the conversation started."
  // =========================================================================
  try {
    // Collect pending starter reminders keyed by recipient user ID (max 1 reminder per recipient)
    const pendingStartersByUser = new Map<string, {
      userId: string;
      title: string;
      body: string;
      url: string;
      sessionId?: string;
      threadId?: string;
      initialTime: number;
    }>();

    // 2A. Direct Q&A Sessions (chat_sessions)
    const { data: sessions, error: sessionsErr } = await supabase
      .from("chat_sessions")
      .select(`
        id,
        question_id,
        created_at,
        questions!inner(id, asker_id, body, created_at, status),
        chat_participants(user_id, alias),
        chat_messages(id, sender_id, body, created_at)
      `)
      .not("question_id", "is", null);

    if (!sessionsErr && sessions) {
      for (const session of sessions) {
        const q = session.questions as any;
        if (!q || q.status === "closed") continue;

        const askerId = q.asker_id;
        const participants = session.chat_participants || [];
        const recipientP = participants.find((p: any) => p.user_id !== askerId);
        const askerP = participants.find((p: any) => p.user_id === askerId);

        if (!recipientP) continue;

        // Skip bot/AI participants
        if (askerP?.alias === "ProxNet AI" || recipientP.alias === "ProxNet AI") continue;

        // Verify recipient has NEVER responded to this session (0 messages from recipient)
        const recipientMessages = (session.chat_messages || []).filter((m: any) => m.sender_id === recipientP.user_id);
        if (recipientMessages.length > 0) {
          // Recipient already responded; not an unstarted conversation
          continue;
        }

        // Check if initial message was sent >= 24 hours ago
        const initialTimestamp = new Date(q.created_at).getTime();
        const hoursSinceInitial = (now - initialTimestamp) / (1000 * 60 * 60);
        if (hoursSinceInitial < 24) {
          continue;
        }

        const senderAlias = askerP?.alias || "A neighbor";
        const snippet = (q.body || "").replace(/\n+/g, " ").trim();
        const cleanSnippet = snippet.length > 65 ? `${snippet.slice(0, 65)}...` : snippet;

        const title = `💬 New conversation waiting from ${senderAlias}`;
        const bodyText = `${senderAlias} reached out to you: "${cleanSnippet}". Tap to reply and start the conversation!`;
        const targetUrl = `/chat/${session.id}`;

        const existing = pendingStartersByUser.get(recipientP.user_id);
        if (!existing || initialTimestamp > existing.initialTime) {
          pendingStartersByUser.set(recipientP.user_id, {
            userId: recipientP.user_id,
            title,
            body: bodyText,
            url: targetUrl,
            sessionId: session.id,
            initialTime: initialTimestamp,
          });
        }
      }
    }

    // 2B. Job Referral Threads (job_threads)
    const { data: threads, error: threadsErr } = await supabase
      .from("job_threads")
      .select(`
        id,
        status,
        created_at,
        job_participants(user_id, alias),
        job_messages(id, sender_id, body, created_at)
      `)
      .eq("status", "active");

    if (!threadsErr && threads) {
      for (const thread of threads) {
        const messages = (thread.job_messages || []).sort(
          (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        if (messages.length === 0) continue;

        // Opening message is the very first message
        const openingMsg = messages[0];
        const initiatorId = openingMsg.sender_id;
        const participants = thread.job_participants || [];
        const recipientP = participants.find((p: any) => p.user_id !== initiatorId);
        const initiatorP = participants.find((p: any) => p.user_id === initiatorId);

        if (!recipientP) continue;

        // Verify recipient has NEVER responded (0 messages from recipient)
        const recipientMessages = messages.filter((m: any) => m.sender_id === recipientP.user_id);
        if (recipientMessages.length > 0) {
          // Recipient already responded; not an unstarted conversation
          continue;
        }

        // Check if initial message was sent >= 24 hours ago
        const initialTimestamp = new Date(openingMsg.created_at).getTime();
        const hoursSinceInitial = (now - initialTimestamp) / (1000 * 60 * 60);
        if (hoursSinceInitial < 24) {
          continue;
        }

        const senderAlias = initiatorP?.alias || "A colleague";
        const snippet = (openingMsg.body || "").replace(/\n+/g, " ").trim();
        const cleanSnippet = snippet.length > 65 ? `${snippet.slice(0, 65)}...` : snippet;

        const title = `🤝 Referral request waiting from ${senderAlias}`;
        const bodyText = `${senderAlias} reached out regarding an opportunity: "${cleanSnippet}". Tap to start the conversation!`;
        const targetUrl = `/jobs/chat/${thread.id}`;

        const existing = pendingStartersByUser.get(recipientP.user_id);
        if (!existing || initialTimestamp > existing.initialTime) {
          pendingStartersByUser.set(recipientP.user_id, {
            userId: recipientP.user_id,
            title,
            body: bodyText,
            url: targetUrl,
            threadId: thread.id,
            initialTime: initialTimestamp,
          });
        }
      }
    }

    // 2C. Dispatch notifications to recipients (throttled to 1 per user, de-duplicated within 24h)
    const targetUserIds = Array.from(pendingStartersByUser.keys());
    if (targetUserIds.length > 0) {
      const { data: recentChatNotifs } = await supabase
        .from("in_app_notifications")
        .select("user_id, url")
        .in("user_id", targetUserIds)
        .gte("created_at", twentyFourHoursAgo);

      const recentNotifUrlSet = new Set(
        (recentChatNotifs || []).map((n) => `${n.user_id}_${n.url}`)
      );

      for (const [userId, item] of pendingStartersByUser.entries()) {
        const notifKey = `${userId}_${item.url}`;
        if (recentNotifUrlSet.has(notifKey)) continue;

        try {
          await sendNotification(userId, {
            title: item.title,
            body: item.body,
            url: item.url,
            data: {
              type: "chat_starter_reminder",
              sessionId: item.sessionId,
              threadId: item.threadId,
              soundType: "message",
              sound: "default",
            },
          });

          starterRemindersSent++;
          auditLog.push({
            type: "chat_starter_reminder",
            userId,
            title: item.title,
            url: item.url,
          });
        } catch (err) {
          console.warn(`Failed to send starter reminder to ${userId}:`, err);
        }
      }
    }
  } catch (chatErr) {
    console.error("Error processing unresponded opening message reminders:", chatErr);
  }

  return NextResponse.json({
    success: true,
    scheduledTime: "09:00 AM IST (03:30 UTC)",
    profileRemindersSent,
    starterRemindersSent,
    totalSent: profileRemindersSent + starterRemindersSent,
    auditLog: auditLog.slice(0, 20),
  });
}

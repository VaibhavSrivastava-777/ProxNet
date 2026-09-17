/* eslint-disable @typescript-eslint/no-explicit-any */

export interface EmailTemplatePayload {
  recipientName: string;
  recipientEmail: string;
  title: string;
  body: string;
  url: string;
  data?: Record<string, any>;
  otherUnreadNotifs?: Array<{
    id: string;
    title: string;
    body: string;
    url: string;
    created_at?: string;
  }>;
}

export interface GeneratedEmail {
  subject: string;
  html: string;
  category: "action" | "message" | "job" | "event" | "social" | "digest" | "general";
}

// In-memory sliding rate limiter to prevent spamming users
interface UserEmailStats {
  lastSentAt: number;
  lastChatSentAt: number;
  lastDigestSentAt: number;
  dateStr: string;
  countToday: number;
}

const userEmailRateMap = new Map<string, UserEmailStats>();

/**
 * Anti-spam gatekeeper to prevent inbox flooding for users without FCM tokens.
 */
export function checkEmailRateLimit(
  userId: string,
  notificationType: string,
  forceEmail?: boolean
): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const todayStr = new Date().toISOString().slice(0, 10);

  let stats = userEmailRateMap.get(userId);
  if (!stats || stats.dateStr !== todayStr) {
    stats = {
      lastSentAt: 0,
      lastChatSentAt: 0,
      lastDigestSentAt: 0,
      dateStr: todayStr,
      countToday: 0,
    };
    userEmailRateMap.set(userId, stats);
  }

  // Absolute hard cap per day
  const maxDaily = forceEmail ? 10 : 5;
  if (stats.countToday >= maxDaily) {
    return { allowed: false, reason: `Daily limit reached (${stats.countToday}/${maxDaily})` };
  }

  // Cooldown rules for real-time chat
  const isChatMessage =
    notificationType === "chat_message" ||
    notificationType === "colleague_message" ||
    notificationType === "chat_starter_reminder";

  if (isChatMessage && !forceEmail) {
    const timeSinceLastChat = now - stats.lastChatSentAt;
    const CHAT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
    if (timeSinceLastChat < CHAT_COOLDOWN_MS) {
      return { allowed: false, reason: `Chat email cooldown active (${Math.round((CHAT_COOLDOWN_MS - timeSinceLastChat) / 1000)}s left)` };
    }
  }

  // Cooldown rules for digests / nudges / engagement
  const isDigestOrNudge =
    notificationType.startsWith("weekly_digest") ||
    notificationType.startsWith("daily_engagement") ||
    notificationType.startsWith("referral_network_nudge") ||
    notificationType === "profile_reminder";

  if (isDigestOrNudge && !forceEmail) {
    const timeSinceLastDigest = now - stats.lastDigestSentAt;
    const DIGEST_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours
    if (timeSinceLastDigest < DIGEST_COOLDOWN_MS) {
      return { allowed: false, reason: `Digest/nudge cooldown active (${Math.round((DIGEST_COOLDOWN_MS - timeSinceLastDigest) / (60 * 1000))}m left)` };
    }
  }

  return { allowed: true };
}

/**
 * Record that an email was successfully dispatched.
 */
export function recordEmailSent(userId: string, notificationType: string) {
  const now = Date.now();
  const todayStr = new Date().toISOString().slice(0, 10);
  let stats = userEmailRateMap.get(userId);
  if (!stats || stats.dateStr !== todayStr) {
    stats = {
      lastSentAt: now,
      lastChatSentAt: 0,
      lastDigestSentAt: 0,
      dateStr: todayStr,
      countToday: 1,
    };
  } else {
    stats.lastSentAt = now;
    stats.countToday += 1;
  }

  if (
    notificationType === "chat_message" ||
    notificationType === "colleague_message" ||
    notificationType === "chat_starter_reminder"
  ) {
    stats.lastChatSentAt = now;
  }

  if (
    notificationType.startsWith("weekly_digest") ||
    notificationType.startsWith("daily_engagement") ||
    notificationType.startsWith("referral_network_nudge") ||
    notificationType === "profile_reminder"
  ) {
    stats.lastDigestSentAt = now;
  }

  userEmailRateMap.set(userId, stats);
}

/**
 * Generate context-specific responsive HTML email with direct CTA buttons.
 */
export function generateContextEmail(payload: EmailTemplatePayload): GeneratedEmail {
  const { recipientName, recipientEmail, title, body, url, data, otherUnreadNotifs } = payload;
  const baseUrl = "https://www.proxnet.in";
  const actionUrl = url?.startsWith("http") ? url : `${baseUrl}${url || "/"}`;
  const notifType = String(data?.type || "general");

  // Determine context attributes
  let subject = title;
  let category: GeneratedEmail["category"] = "general";
  let badgeText = "UPDATE";
  let badgeColor = "#0A66C2";
  let badgeBg = "#eff6ff";
  let heading = title;
  let bodyHtml = `<p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0;">${escapeHtml(body)}</p>`;
  let ctaLabel = "Open in ProxNet &rarr;";
  let ctaUrl = actionUrl;
  let keyDetailsHtml = "";

  // 1. Profile Completion Reminder
  if (notifType === "profile_reminder" || notifType === "complete_profile") {
    category = "action";
    subject = "📝 Action Required: Complete your ProxNet profile";
    badgeText = "ACTION REQUIRED";
    badgeColor = "#d97706";
    badgeBg = "#fef3c7";
    heading = "Unlock Your Neighborhood Professional Network";
    ctaLabel = "Complete My Profile &rarr;";
    ctaUrl = `${baseUrl}/profile`;

    bodyHtml = `
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
        Your ProxNet profile is currently incomplete. Adding your designation, current company, and neighborhood location takes less than 60 seconds and instantly connects you with nearby peers.
      </p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 8px;">
        <p style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 0 0 8px 0;">Why complete your profile?</p>
        <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #475569; line-height: 1.6;">
          <li><strong>Get discovered:</strong> Nearby colleagues and tech neighbors can find and message you.</li>
          <li><strong>Unlock 90%+ Job Matches:</strong> Accurate referral matching based on your role.</li>
          <li><strong>Earn credibility:</strong> Unlock the verified local professional badge.</li>
        </ul>
      </div>
    `;
  }

  // 2. Enable Notifications Reminder
  else if (notifType === "enable_notifications" || notifType === "push_enable_reminder") {
    category = "action";
    subject = "🔔 Turn on push notifications to receive instant updates";
    badgeText = "NOTIFICATION SETTINGS";
    badgeColor = "#2563eb";
    badgeBg = "#eff6ff";
    heading = "Never Miss an Urgent Message or Referral";
    ctaLabel = "Enable Push Notifications &rarr;";
    ctaUrl = `${baseUrl}/profile#notifications`;

    bodyHtml = `
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
        You are currently receiving notifications via email because push notifications are turned off on your device. When a colleague messages you or an urgent job match is posted, instant alerts make all the difference.
      </p>
      <div style="background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%); border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px 16px; margin-bottom: 8px;">
        <p style="margin: 0; font-size: 14px; font-weight: 700; color: #15803d;">
          🎁 Earn 5 Free Wallet Credits
        </p>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #166534; line-height: 1.4;">
          Enable notifications in your profile settings to receive 5 bonus credits instantly added to your wallet!
        </p>
      </div>
    `;
  }

  // 3. Unresponded Opening Message / Chat Starter Reminder
  else if (notifType === "chat_starter_reminder") {
    category = "message";
    badgeText = "NEW CONVERSATION";
    badgeColor = "#0A66C2";
    badgeBg = "#eff6ff";
    heading = "A Neighbor Reached Out to You";
    ctaLabel = "Reply to Conversation &rarr;";
    ctaUrl = actionUrl;

    bodyHtml = `
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
        Someone in your proximity initiated a conversation with you over 24 hours ago and is eagerly waiting for your response.
      </p>
      <div style="background-color: #f1f5f9; border-left: 4px solid #0A66C2; border-radius: 0 8px 8px 0; padding: 14px 16px; margin-bottom: 12px;">
        <p style="font-size: 14px; color: #1e293b; font-style: italic; margin: 0;">
          "${escapeHtml(body)}"
        </p>
      </div>
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        Replying helps build a responsive, trusted hyperlocal tech community.
      </p>
    `;
  }

  // 4. Real-Time Chat Message
  else if (notifType === "chat_message") {
    category = "message";
    const sender = data?.senderAlias || "A neighbor";
    subject = `💬 New message from ${sender} on ProxNet`;
    badgeText = "DIRECT MESSAGE";
    badgeColor = "#0A66C2";
    badgeBg = "#eff6ff";
    heading = `Message from ${escapeHtml(sender)}`;
    ctaLabel = "Reply in Chat &rarr;";
    ctaUrl = actionUrl;

    bodyHtml = `
      <div style="background-color: #f1f5f9; border-left: 4px solid #0A66C2; border-radius: 0 8px 8px 0; padding: 14px 16px; margin-bottom: 16px;">
        <p style="font-size: 15px; color: #1e293b; margin: 0; line-height: 1.5;">
          ${escapeHtml(body)}
        </p>
      </div>
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        Tap below to open your secure chat session and continue the discussion.
      </p>
    `;
  }

  // 5. Referral Request / Colleague Message
  else if (notifType === "referral_request" || notifType === "job_referral_request" || notifType === "colleague_message") {
    category = "message";
    badgeText = "REFERRAL REQUEST";
    badgeColor = "#7c3aed";
    badgeBg = "#f5f3ff";
    heading = "Referral Request from a Colleague";
    ctaLabel = "View & Reply in Chat &rarr;";
    ctaUrl = actionUrl;

    const pitchPreview = data?.initialMessage || body;

    bodyHtml = `
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
        A verified professional in your ProxNet network has reached out for a referral at your company:
      </p>
      <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
        <p style="font-size: 15px; color: #581c87; font-weight: 700; margin: 0 0 8px 0;">
          ${escapeHtml(title)}
        </p>
        <p style="font-size: 14px; color: #4b164c; margin: 0; line-height: 1.6; white-space: pre-wrap;">
          "${escapeHtml(pitchPreview)}"
        </p>
      </div>
      <p style="font-size: 13px; color: #64748b; margin: 0 0 16px 0;">
        Providing internal referrals helps great local talent connect with your team and earns you network karma on ProxNet.
      </p>
    `;
  }

  // 6. Strong Job Match (75%+)
  else if (notifType === "job_match_75" || notifType === "job_match") {
    category = "job";
    const matchRate = data?.matchRate || "75+";
    const company = data?.company || "Top Tech Company";
    badgeText = `🔥 ${matchRate}% MATCH`;
    badgeColor = "#ea580c";
    badgeBg = "#fff7ed";
    heading = `Strong Job Match: ${escapeHtml(company)}`;
    ctaLabel = "View Job & Referral Details &rarr;";
    ctaUrl = actionUrl;

    keyDetailsHtml = `
      <div style="display: flex; gap: 8px; margin-bottom: 16px;">
        <span style="background-color: #ffedd5; color: #9a3412; font-weight: 700; font-size: 12px; padding: 4px 10px; border-radius: 20px;">
          Match Score: ${matchRate}%
        </span>
        <span style="background-color: #dbeafe; color: #1e40af; font-weight: 700; font-size: 12px; padding: 4px 10px; border-radius: 20px;">
          Inside Referral Available
        </span>
      </div>
    `;

    bodyHtml = `
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
        Our matching engine identified a verified opening that strongly matches your profile and skills:
      </p>
      <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; border-radius: 0 8px 8px 0; padding: 14px 16px; margin-bottom: 16px;">
        <p style="font-size: 15px; font-weight: 700; color: #9a3412; margin: 0 0 4px 0;">
          ${escapeHtml(title)}
        </p>
        <p style="font-size: 14px; color: #7c2d12; line-height: 1.5; margin: 0;">
          ${escapeHtml(body)}
        </p>
      </div>
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        ProxNet also identifies verified neighbors currently working at this company who can refer you directly.
      </p>
    `;
  }

  // 7. Weekly Job Digest
  else if (notifType.startsWith("weekly_digest")) {
    category = "digest";
    badgeText = "WEEKLY DIGEST";
    badgeColor = "#0A66C2";
    badgeBg = "#eff6ff";
    heading = "Your Weekly Hyperlocal Job Digest";
    ctaLabel = "Explore This Week's Jobs &rarr;";
    ctaUrl = `${baseUrl}/jobs`;

    bodyHtml = `
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
        Here is your weekly summary of verified tech roles posted directly by employers in your tech cluster.
      </p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
        <p style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0;">
          ${escapeHtml(title)}
        </p>
        <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0;">
          ${escapeHtml(body)}
        </p>
      </div>
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        Tip: Make sure your resume is up-to-date in your profile to unlock personalized 90%+ match rankings.
      </p>
    `;
  }

  // 8. Referral Network Nudge
  else if (notifType === "referral_network_nudge") {
    category = "action";
    const comp = data?.company || "target company";
    const refCount = data?.referrerCount || 1;
    badgeText = "REFERRAL NETWORK";
    badgeColor = "#059669";
    badgeBg = "#ecfdf5";
    heading = `Inside Referrals at ${escapeHtml(comp)}`;
    ctaLabel = "Connect with Insiders &rarr;";
    ctaUrl = actionUrl;

    bodyHtml = `
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
        We spotted open positions at <strong>${escapeHtml(comp)}</strong> and found <strong>${refCount} verified ProxNet member${refCount > 1 ? "s" : ""}</strong> who live or work right near you.
      </p>
      <div style="background-color: #ecfdf5; border-left: 4px solid #059669; border-radius: 0 8px 8px 0; padding: 14px 16px; margin-bottom: 16px;">
        <p style="font-size: 14px; color: #065f46; line-height: 1.5; margin: 0;">
          ${escapeHtml(body)}
        </p>
      </div>
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        Connecting with colleagues living in your proximity is the fastest way to get referred and skip the recruiter queue.
      </p>
    `;
  }

  // 9. Local Meetups / Events
  else if (notifType.startsWith("event_") || notifType === "rsvp_24h" || notifType === "rsvp_4h") {
    category = "event";
    badgeText = "LOCAL MEETUP";
    badgeColor = "#db2777";
    badgeBg = "#fdf2f8";
    heading = "Upcoming Tech Meetup Near You";
    ctaLabel = "View Event Details & RSVP &rarr;";
    ctaUrl = actionUrl;

    bodyHtml = `
      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
        A professional meetup is happening right in your neighborhood:
      </p>
      <div style="background-color: #fdf2f8; border-left: 4px solid #db2777; border-radius: 0 8px 8px 0; padding: 14px 16px; margin-bottom: 16px;">
        <p style="font-size: 15px; font-weight: 700; color: #9d174d; margin: 0 0 4px 0;">
          ${escapeHtml(title)}
        </p>
        <p style="font-size: 14px; color: #831843; line-height: 1.5; margin: 0;">
          ${escapeHtml(body)}
        </p>
      </div>
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        RSVP to secure your spot and see which colleagues are attending.
      </p>
    `;
  }

  // 10. Daily Engagement Rotating Nudge
  else if (notifType.startsWith("daily_engagement")) {
    category = "digest";
    badgeText = "HYPERLOCAL UPDATE";
    badgeColor = "#0284c7";
    badgeBg = "#f0f9ff";
    heading = "What's Happening in Your Neighborhood";
    ctaLabel = "Explore on ProxNet &rarr;";
    ctaUrl = actionUrl;

    bodyHtml = `
      <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; border-radius: 0 8px 8px 0; padding: 14px 16px; margin-bottom: 16px;">
        <p style="font-size: 15px; font-weight: 700; color: #0369a1; margin: 0 0 4px 0;">
          ${escapeHtml(title)}
        </p>
        <p style="font-size: 14px; color: #0c4a6e; line-height: 1.5; margin: 0;">
          ${escapeHtml(body)}
        </p>
      </div>
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        ProxNet connects you with verified tech professionals living and working within 2km of your location.
      </p>
    `;
  }

  // 11. New Follower
  else if (notifType === "new_follower") {
    category = "social";
    badgeText = "NEW FOLLOWER";
    badgeColor = "#4f46e5";
    badgeBg = "#eef2ff";
    heading = "Your Network is Growing";
    ctaLabel = "View Follower & Profile &rarr;";
    ctaUrl = `${baseUrl}/profile`;

    bodyHtml = `
      <div style="background-color: #eef2ff; border-left: 4px solid #4f46e5; border-radius: 0 8px 8px 0; padding: 14px 16px; margin-bottom: 16px;">
        <p style="font-size: 15px; color: #312e81; line-height: 1.5; margin: 0;">
          ${escapeHtml(body)}
        </p>
      </div>
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        Follow back to see their updates and questions in your local feed.
      </p>
    `;
  }

  // 12. Local Q&A / Forum
  else if (notifType === "new_forum_post" || notifType === "new_question" || notifType === "question_responded") {
    category = "action";
    badgeText = "LOCAL Q&A";
    badgeColor = "#0891b2";
    badgeBg = "#ecfeff";
    heading = "Neighborhood Q&A Activity";
    ctaLabel = "View Discussion &rarr;";
    ctaUrl = actionUrl;

    bodyHtml = `
      <div style="background-color: #ecfeff; border-left: 4px solid #0891b2; border-radius: 0 8px 8px 0; padding: 14px 16px; margin-bottom: 16px;">
        <p style="font-size: 15px; font-weight: 700; color: #155e75; margin: 0 0 4px 0;">
          ${escapeHtml(title)}
        </p>
        <p style="font-size: 14px; color: #164e63; line-height: 1.5; margin: 0;">
          ${escapeHtml(body)}
        </p>
      </div>
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        Share your knowledge or get answers from verified professionals in your locality.
      </p>
    `;
  }

  // Build the clubbed unread activity section if other unread notifications exist
  let clubbedSectionHtml = "";
  if (otherUnreadNotifs && otherUnreadNotifs.length > 0) {
    const itemsHtml = otherUnreadNotifs
      .slice(0, 3)
      .map((item) => {
        const itemUrl = item.url?.startsWith("http") ? item.url : `${baseUrl}${item.url || "/"}`;
        return `
          <li style="margin-bottom: 8px; font-size: 13px; color: #334155; line-height: 1.4;">
            <a href="${itemUrl}" style="color: #0A66C2; text-decoration: none; font-weight: 600;">
              ${escapeHtml(item.title)}
            </a>
            <span style="display: block; color: #64748b; font-size: 12px; margin-top: 2px;">
              ${escapeHtml(item.body.slice(0, 90))}${item.body.length > 90 ? "..." : ""}
            </span>
          </li>
        `;
      })
      .join("");

    clubbedSectionHtml = `
      <!-- Clubbed / Batch Activity Digest Section -->
      <div style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
        <div style="display: flex; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 13px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">
            📌 Also waiting for you (${otherUnreadNotifs.length} other update${otherUnreadNotifs.length > 1 ? "s" : ""})
          </span>
        </div>
        <ul style="margin: 0; padding-left: 16px;">
          ${itemsHtml}
        </ul>
        <div style="text-align: right; margin-top: 10px;">
          <a href="${baseUrl}/notifications" style="font-size: 12px; color: #0A66C2; font-weight: 600; text-decoration: none;">
            View all notifications &rarr;
          </a>
        </div>
      </div>
    `;
  }

  // Full HTML assembly
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(subject)}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 12px; color: #1e293b; -webkit-font-smoothing: antialiased;">
      <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0A66C2 0%, #004182 100%); padding: 22px 28px; text-align: left;">
          <span style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Prox<span style="color: #60a5fa;">Net</span></span>
          <span style="display: block; font-size: 13px; color: #bfdbfe; margin-top: 3px;">Hyperlocal Professional Community</span>
        </div>

        <!-- Content Body -->
        <div style="padding: 28px;">
          
          <!-- Category Badge & Greeting -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeColor}; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; padding: 4px 10px; border-radius: 20px;">
              ${badgeText}
            </span>
          </div>

          <p style="font-size: 14px; color: #64748b; margin-top: 0; margin-bottom: 6px;">Hi ${escapeHtml(recipientName)},</p>
          <h2 style="font-size: 19px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 16px; line-height: 1.35;">
            ${escapeHtml(heading)}
          </h2>

          ${keyDetailsHtml}
          ${bodyHtml}

          <!-- Call To Action Button -->
          <div style="text-align: center; margin: 30px 0 24px 0;">
            <a href="${ctaUrl}" style="background: linear-gradient(135deg, #0A66C2 0%, #0052a3 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 10px rgba(10, 102, 194, 0.3); letter-spacing: 0.2px;">
              ${ctaLabel}
            </a>
          </div>

          ${clubbedSectionHtml}

          <!-- Push Notification Conversion Tip -->
          <div style="margin-top: 28px; padding: 14px 16px; background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%); border-radius: 12px; border: 1px solid #dbeafe;">
            <p style="margin: 0; font-size: 13px; color: #1e40af; font-weight: 700;">
              💡 Want instant alerts without checking email?
            </p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #475569; line-height: 1.4;">
              Enable push notifications on your phone or browser to receive real-time chat replies, and earn 5 bonus wallet credits!
              <a href="${baseUrl}/profile#notifications" style="color: #0A66C2; font-weight: 600; text-decoration: underline; margin-left: 4px;">
                Turn on notifications
              </a>
            </p>
          </div>

        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 28px; text-align: center; font-size: 12px; color: #94a3b8;">
          <p style="margin: 0;">This email was sent to ${escapeHtml(recipientEmail)} based on your ProxNet activity.</p>
          <p style="margin: 6px 0 0 0;">
            <a href="${baseUrl}/profile" style="color: #64748b; text-decoration: underline;">Notification Settings</a> &bull;
            <a href="${baseUrl}" style="color: #64748b; text-decoration: underline;">proxnet.in</a>
          </p>
        </div>

      </div>
    </body>
    </html>
  `;

  return { subject, html, category };
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

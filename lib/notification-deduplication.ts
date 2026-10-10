/**
 * Shared notification deduplication logic for in-app notification center
 * and email digests ("Also waiting for you").
 */

export interface BaseNotification {
  id?: string;
  title?: string;
  body?: string;
  url?: string;
  is_read?: boolean;
  created_at?: string;
  data?: Record<string, any>;
}

/**
 * Returns a canonical category/thread key for a notification to identify duplicates.
 */
export function getNotificationDeduplicationKey(notif: {
  title?: string;
  body?: string;
  url?: string;
  data?: Record<string, any>;
}): string {
  const title = (notif.title || "").trim();
  const body = (notif.body || "").trim();
  const rawUrl = (notif.url || "").trim();
  const tLower = title.toLowerCase();
  const bLower = body.toLowerCase();
  const uLower = rawUrl.toLowerCase();

  // 1. Profile Completion Reminders
  if (
    uLower === "/profile" ||
    uLower.includes("wizard=profile") ||
    uLower.includes("complete_profile=true") ||
    /complete your profile|profile completion|finish your profile|complete profile to unlock|complete your professional profile|profile incomplete/i.test(
      title
    ) ||
    /complete your profile by adding|profile incomplete/i.test(body)
  ) {
    return "category:profile_completion";
  }

  // 2. Chat & Messaging (Direct, Jobs referral thread, Carpool thread)
  const chatMatch = rawUrl.match(/\/(?:carpool\/chat|jobs\/chat|chat)\/([a-zA-Z0-9_-]+)/i);
  if (chatMatch) {
    return `chat:${chatMatch[1].toLowerCase()}`;
  }

  // 3. Daily Top Jobs / Job Digest Opportunities
  if (
    /top\s*\d*\s*job opportunities|job opportunities today|daily job digest|top job matches today|new job match/i.test(
      title
    ) ||
    (uLower.startsWith("/jobs?highlight=") && /top\s*\d*\s*job/i.test(title))
  ) {
    return "category:daily_job_opportunities";
  }

  // 4. Referral Request / Bridge Request
  const refMatch = rawUrl.match(/\/jobs\/chat\/([a-zA-Z0-9_-]+)/i);
  if (refMatch || /referral request waiting|bridge request/i.test(title)) {
    if (refMatch) return `referral_chat:${refMatch[1].toLowerCase()}`;
    return "category:referral_request";
  }

  // 5. Daily Streak & Check-in
  if (/streak|check-in|daily check-in/i.test(title) || uLower.includes("/streak")) {
    return "category:daily_streak";
  }

  // 6. Micro-Status Beacons (Chai, Walk, Meetup)
  if (
    /ready for chai|out for a walk|live beacon active|micro-meetup/i.test(title) ||
    /ready for chai|out for a walk/i.test(body)
  ) {
    return "category:live_beacon";
  }

  // 7. Profile Celebrations / Graffiti Cheer
  if (/celebrated your|profile celebrated|graffiti cheer/i.test(title)) {
    const sender = notif.data?.celebratorId || notif.data?.celebratorName;
    if (sender) return `celebration:${String(sender).toLowerCase()}`;
    return "category:profile_celebration";
  }

  // 8. Specific Events
  const eventMatch = rawUrl.match(/\/(?:events?|e)\/([a-zA-Z0-9_-]+)/i);
  if (eventMatch) {
    return `event:${eventMatch[1].toLowerCase()}`;
  }

  // 9. Specific Forum Questions
  const questionMatch = rawUrl.match(/\/(?:questions?|qa\/forum)\/([a-zA-Z0-9_-]+)/i);
  if (questionMatch) {
    return `question:${questionMatch[1].toLowerCase()}`;
  }

  // 10. Canonical URL & Normalized Title Fallback
  // Strip ephemeral query parameters
  const baseUrl = rawUrl.split("?")[0].toLowerCase().trim();
  const cleanTitle = tLower.replace(/[^a-z0-9]/g, "");

  if (baseUrl && baseUrl !== "/" && baseUrl !== "/qa") {
    if (cleanTitle) {
      return `url:${baseUrl}|title:${cleanTitle}`;
    }
    return `url:${baseUrl}`;
  }

  const cleanBody = bLower.replace(/[^a-z0-9]/g, "").slice(0, 40);
  return `title:${cleanTitle}|body:${cleanBody}`;
}

/**
 * Deduplicates a list of notifications, always keeping the latest notification
 * per topic/intent/thread and preserving unread status if any instance was unread.
 */
export function deduplicateNotifications<T extends BaseNotification>(notifications: T[]): T[] {
  if (!Array.isArray(notifications) || notifications.length === 0) return [];

  // Sort newest first to ensure the latest notification for each key is selected
  const sorted = [...notifications].sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeB - timeA;
  });

  const seenMap = new Map<string, T>();
  const unreadStatusMap = new Map<string, boolean>();

  for (const notif of sorted) {
    const key = getNotificationDeduplicationKey(notif);

    // If any notification in this duplicate group is unread, preserve unread state
    if (notif.is_read === false) {
      unreadStatusMap.set(key, false);
    }

    if (!seenMap.has(key)) {
      seenMap.set(key, notif);
    }
  }

  const deduplicated: T[] = [];
  for (const [key, notif] of seenMap.entries()) {
    const shouldBeUnread = unreadStatusMap.get(key) === false;
    if (shouldBeUnread && notif.is_read !== false) {
      deduplicated.push({ ...notif, is_read: false });
    } else {
      deduplicated.push(notif);
    }
  }

  return deduplicated;
}

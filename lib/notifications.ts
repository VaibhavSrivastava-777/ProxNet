/* eslint-disable @typescript-eslint/no-explicit-any */
import { fcmMessaging } from "./firebase-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { deduplicateNotifications, getNotificationDeduplicationKey } from "./notification-deduplication";

/**
 * Frames FCM notification title and body into concise, complete sentences
 * that fit standard push notification preview boundaries (Title <= 45 chars, Body <= 110-120 chars)
 * and never truncate awkwardly on mobile or desktop lock screens.
 */
export function frameFcmNotification(
  title: string,
  body: string,
  data?: Record<string, any>
): { title: string; body: string } {
  let fcmTitle = (title || "ProxNet").trim();
  let fcmBody = (body || "").trim();

  const notifType = String(data?.type || "");
  const isTop3Jobs =
    notifType === "daily_top_3_jobs" ||
    notifType === "morning_job_brief" ||
    notifType === "top_3_jobs" ||
    fcmTitle.toLowerCase().includes("top 3") ||
    fcmBody.toLowerCase().includes("top 3");

  // 1. Specialized sentence framing for Top 3 Job Opportunities
  if (isTop3Jobs) {
    fcmTitle = "🎯 Top 3 Job Matches Today";

    // Extract companies if present in body or data
    const companyMatches = Array.from(body.matchAll(/@\s*([^(\n|]+)/g))
      .map((m) => m[1]?.trim())
      .filter(Boolean);

    if (companyMatches.length >= 2) {
      const distinctCos = Array.from(new Set(companyMatches)).slice(0, 3);
      if (distinctCos.length === 3) {
        fcmBody = `Top matches at ${distinctCos[0]}, ${distinctCos[1]} & ${distinctCos[2]}. Tap to review & apply!`;
      } else {
        fcmBody = `Top matches at ${distinctCos.join(" & ")}. Tap to review & apply!`;
      }
    } else {
      fcmBody = "3 top opportunities match your profile today. Tap to review all 3 & apply!";
    }

    return { title: fcmTitle, body: fcmBody };
  }

  // 2. Title framing (keep under 45 chars so it doesn't get clipped with ...)
  if (fcmTitle.length > 45) {
    if (fcmTitle.includes("Job Match")) {
      const matchPercent = fcmTitle.match(/\((\d+%)\)/)?.[1] || "";
      const atCompany = fcmTitle.match(/at\s+([^:]+)/i)?.[1]?.trim();
      if (atCompany) {
        fcmTitle = `🔥 ${matchPercent ? matchPercent + " " : ""}Match: ${atCompany}`.slice(0, 45);
      } else {
        fcmTitle = fcmTitle.slice(0, 42).trim() + "...";
      }
    } else if (fcmTitle.includes("New Message from")) {
      const sender = fcmTitle.replace(/^New Message from\s+/i, "").split("@")[0].trim();
      fcmTitle = `💬 Message from ${sender}`.slice(0, 45);
    } else {
      const cut = fcmTitle.slice(0, 42);
      const lastSpace = cut.lastIndexOf(" ");
      fcmTitle = (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim() + "...";
    }
  }

  // 3. Body framing (keep under 120 chars so mobile collapsed view does not truncate)
  if (fcmBody.length > 120) {
    // Attempt to end cleanly at the first complete sentence if between 25 and 115 chars
    const sentenceMatch = fcmBody.match(/^(.+?[.!?])(?:\s+|$)/);
    if (sentenceMatch && sentenceMatch[1].length >= 25 && sentenceMatch[1].length <= 115) {
      fcmBody = sentenceMatch[1].trim();
    } else {
      const sub = fcmBody.slice(0, 110);
      const lastSpace = sub.lastIndexOf(" ");
      const cleanSub = (lastSpace > 30 ? sub.slice(0, lastSpace) : sub).trim();
      fcmBody = cleanSub.endsWith(".") || cleanSub.endsWith("!") ? cleanSub : `${cleanSub}. Tap to view!`;
      if (fcmBody.length > 120) {
        fcmBody = cleanSub + "...";
      }
    }
  }

  return { title: fcmTitle, body: fcmBody };
}

export async function sendNotification(
  userId: string,
  { title, body, url, data }: { title: string; body: string; url: string; data?: Record<string, any> }
) {
  const supabase = createAdminClient();

  const sanitizedUrl = url || "/";
  // 0. Persist to in_app_notifications table (Guaranteed first step for all notifications)
  try {
    const { error: insertError } = await supabase
      .from("in_app_notifications")
      .insert({
        user_id: userId,
        title: title || "Notification",
        body: body || "",
        url: sanitizedUrl
      });

    if (insertError) {
      console.error("[sendNotification] Failed to insert in-app notification:", insertError, { userId, title, url: sanitizedUrl });
    }
  } catch (err) {
    console.error("[sendNotification] Unexpected error inserting in-app notification:", err);
  }

  // 1. Fetch user's FCM tokens
  const { data: fcmTokens, error: fcmError } = await supabase
    .from("fcm_tokens")
    .select("*")
    .eq("user_id", userId);

  if (fcmError) {
    console.error("Failed to fetch FCM tokens for user:", userId, fcmError);
  }

  // 2. Dispatch FCM notifications with non-truncating sentence framing
  let fcmSuccessCount = 0;
  if (fcmMessaging && fcmTokens && fcmTokens.length > 0) {
    console.log(`Sending FCM to ${fcmTokens.length} active devices for user ${userId}...`);
    
    // Frame sentence specifically for push notification boundaries
    const { title: fcmTitle, body: fcmBody } = frameFcmNotification(title, body, data);

    // Ensure all FCM data payload values are strings (required by Firebase Admin)
    const stringifiedData: Record<string, string> = {
      url: url || "/",
      click_action: `https://www.proxnet.in${url}`,
      type: String(data?.type || "general"),
    };
    if (data) {
      for (const [key, val] of Object.entries(data)) {
        if (val !== undefined && val !== null) {
          stringifiedData[key] = typeof val === "object" ? JSON.stringify(val) : String(val);
        }
      }
    }

    for (const tokenRecord of fcmTokens) {
      try {
        const isIos = tokenRecord.platform === "ios";

        const webpushNotification: Record<string, any> = {
          icon: "https://www.proxnet.in/logo.png",
          badge: "https://www.proxnet.in/icons/icon-96.png",
          silent: false,
          data: { url, ...data },
        };

        // Desktop/Android support rich actions and vibration; iOS WebKit throws TypeError on actions/vibrate
        if (!isIos) {
          webpushNotification.vibrate = [200, 100, 200];
          webpushNotification.actions = [
            { action: "reply", title: "Reply", type: "text", placeholder: "Type a reply..." } as any
          ];
        }

        await fcmMessaging.send({
          token: tokenRecord.token,
          notification: {
            title: fcmTitle,
            body: fcmBody,
          },
          data: stringifiedData,
          webpush: {
            headers: {
              Urgency: "high",
            },
            fcmOptions: {
              link: `https://www.proxnet.in${url}`,
            },
            notification: webpushNotification as any,
          },
          android: {
            priority: "high",
            notification: {
              channelId: "proxnet_messages",
              sound: "default",
              defaultSound: true,
              defaultVibrateTimings: true,
              icon: "@mipmap/ic_launcher",
            },
          },
          apns: {
            headers: {
              "apns-priority": "10",
              "apns-push-type": "alert",
            },
            payload: {
              aps: {
                alert: {
                  title: fcmTitle,
                  body: fcmBody,
                },
                sound: "default",
                badge: 1,
              },
            },
          },
        });
        fcmSuccessCount++;
      } catch (err: any) {
        console.error("FCM delivery failed for token:", tokenRecord.token, err.code);
        // Clean up expired or invalid registration tokens
        if (
          err.code === "messaging/registration-token-not-registered" ||
          err.code === "messaging/invalid-registration-token"
        ) {
          console.log("FCM Token expired/unregistered. Cleaning up database record...");
          await supabase.from("fcm_tokens").delete().eq("id", tokenRecord.id);
        }
      }
    }
  }

  // 3. Send Email Notification via Resend
  // Rule 1: Use Resend email service as universal fallback whenever FCM delivery fails or user has 0 devices
  // Rule 2: Detailed notifications such as top 3 job opportunities should be sent via Resend (in addition to FCM notifications)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    const hasSuccessfulFcm = fcmSuccessCount > 0;
    const notifType = String(data?.type || "general");
    const lowerTitle = (title || "").toLowerCase();
    const lowerBody = (body || "").toLowerCase();

    // Identify detailed notifications (must be sent via Resend in addition to FCM)
    const isDetailedNotification =
      notifType === "daily_top_3_jobs" ||
      notifType === "morning_job_brief" ||
      notifType === "top_3_jobs" ||
      lowerTitle.includes("top 3") ||
      lowerBody.includes("top 3") ||
      notifType === "job_digest" ||
      notifType.startsWith("weekly_digest") ||
      notifType.startsWith("job_match") ||
      data?.isDetailed === true ||
      data?.detailed === true ||
      data?.forceEmail === true ||
      (Array.isArray(data?.jobIds) && data.jobIds.length > 1);

    // Other priority interaction events
    const isPriorityNotification =
      isDetailedNotification ||
      notifType === "profile_reminder" ||
      notifType === "complete_profile" ||
      notifType === "enable_notifications" ||
      notifType === "push_enable_reminder" ||
      notifType === "chat_starter_reminder" ||
      notifType === "starter_reminder" ||
      notifType.startsWith("daily_engagement") ||
      notifType.startsWith("event_") ||
      notifType === "referral_network_nudge" ||
      notifType === "referral_request" ||
      notifType === "job_referral_request" ||
      notifType.includes("referral") ||
      notifType === "new_question" ||
      notifType === "direct_question" ||
      notifType === "beacon_join" ||
      notifType === "beacon_broadcast" ||
      notifType === "colleague_message" ||
      notifType === "chat_message" ||
      notifType === "job_post_nearby" ||
      notifType.includes("hiring") ||
      notifType.includes("looking");

    // 1. Fallback: if 0 devices received FCM (or user has no FCM tokens), ALWAYS fall back to Resend email
    // 2. Detailed / Priority notifications: ALWAYS sent via Resend in addition to FCM
    const isFallback = !hasSuccessfulFcm;
    const shouldSendEmail = isFallback || isDetailedNotification || isPriorityNotification;

    if (shouldSendEmail) {
      let { data: user, error: uError } = await supabase
        .from("users")
        .select("id, email, full_name, company, job_title, home_lat, home_lng, home_name, resume_text, resume_url, linkedin_profile_url, profile_photo_url, about, professional_bio, profile_digest")
        .eq("id", userId)
        .single();

      let recipientEmail = user?.email?.trim();
      if (!recipientEmail) {
        // Fallback to auth.users if public.users record is missing email
        try {
          const { data: authData } = await supabase.auth.admin.getUserById(userId);
          if (authData?.user?.email) {
            recipientEmail = authData.user.email.trim();
            user = {
              ...(user || {}),
              id: user?.id || userId,
              email: recipientEmail,
              full_name: user?.full_name || authData.user.user_metadata?.full_name || "Neighbor",
            } as any;
            // Self-heal public.users record asynchronously
            Promise.resolve(supabase.from("users").update({ email: recipientEmail }).eq("id", userId)).catch(() => {});
          }
        } catch (authErr) {
          console.warn("[Resend] Could not query auth.users fallback:", authErr);
        }
      }

      if (!recipientEmail) {
        console.warn("Could not retrieve user email or email is blank for ID:", userId);
        return;
      }

      const { isProfileComplete, calculateProfileCompleteness } = await import("@/lib/profile-validation");
      const userProfileComplete = user ? isProfileComplete(user) : false;
      const completenessScore = user ? calculateProfileCompleteness(user) : 0;

      const { checkEmailRateLimit, recordEmailSent, generateContextEmail } = await import("@/lib/email-templates");

      // Prioritized Anti-spam & Quota Gate check:
      // Users who completed their profiles receive high-priority delivery allowance.
      // Incomplete profiles are throttled/deprioritized for non-essential digests and capped strictly.
      const rateCheck = checkEmailRateLimit(userId, notifType, {
        forceEmail: data?.forceEmail === true,
        isProfileComplete: userProfileComplete,
        completenessScore,
        isDetailedNotification,
        isFallback,
      });

      if (!rateCheck.allowed) {
        console.log(`[Prioritized Delivery] Suppressed Resend email to ${userId} (${notifType}): ${rateCheck.reason}`);
        return;
      }

      // Query other recent unread notifications to club into a digest if multiple items are waiting
      let otherUnreadNotifs: Array<{ id: string; title: string; body: string; url: string; created_at?: string }> = [];
      try {
        const { data: recentUnread } = await supabase
          .from("in_app_notifications")
          .select("id, title, body, url, created_at")
          .eq("user_id", userId)
          .eq("is_read", false)
          .order("created_at", { ascending: false })
          .limit(25);

        if (recentUnread && recentUnread.length > 0) {
          const currentKey = getNotificationDeduplicationKey({ title, url, body, data });
          const deduped = deduplicateNotifications(recentUnread);
          // Exclude notifications that share the same topic/key or url with the one just sent
          otherUnreadNotifs = deduped
            .filter((n) => getNotificationDeduplicationKey(n) !== currentKey && n.url !== url)
            .slice(0, 3);
        }
      } catch (err) {
        console.warn("Failed to fetch other unread notifications for email clubbing:", err);
      }

      try {
        const recipientName = user?.full_name?.split(" ")[0] || "Neighbor";
        const emailContent = generateContextEmail({
          recipientName,
          recipientEmail: recipientEmail,
          title,
          body,
          url,
          data,
          otherUnreadNotifs,
        });

        console.log(`[Resend] Priority dispatch (${userProfileComplete ? "HIGH - Complete Profile" : "STANDARD/DEPRIORITIZED - Incomplete Profile"}) sending ${emailContent.category} email to ${recipientEmail} (${emailContent.subject})...`);
        const fromEmail = process.env.RESEND_FROM_EMAIL || "notifications@proxnet.in";

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `ProxNet <${fromEmail}>`,
            to: recipientEmail,
            subject: emailContent.subject,
            html: emailContent.html,
            headers: {
              "X-Priority": userProfileComplete ? "1" : "3",
            },
            tags: [
              { name: "profile_complete", value: userProfileComplete ? "true" : "false" },
              { name: "completeness_score", value: String(completenessScore) },
            ],
          }),
          next: { revalidate: 0 },
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          const errorText = errorData ? JSON.stringify(errorData) : await res.text().catch(() => "Unknown error");
          if (res.status === 403 && (errorData?.message?.includes("verify a domain") || errorData?.message?.includes("testing emails"))) {
            console.warn(`[Resend Sandbox Notice] Recipient ${recipientEmail} requires verified domain at resend.com/domains.`);
          } else {
            console.error("[Resend] Email delivery failed:", errorText);
          }
        } else {
          console.log(`[Resend] Notification email successfully delivered to ${recipientEmail}.`);
          recordEmailSent(userId, notifType);

          // Best-effort audit logging into email_notifications_log if table exists
          Promise.resolve(
            supabase.from("email_notifications_log").insert({
              user_id: userId,
              notification_type: notifType,
              subject: emailContent.subject,
              recipient_email: recipientEmail,
            })
          ).catch(() => {});
        }
      } catch (emailErr) {
        console.error("[Resend] Error sending notification email:", emailErr);
      }
    }
  }
}

export async function notifyUsersWithin2km({
  creatorId,
  centerLat,
  centerLng,
  title,
  body,
  url,
  data
}: {
  creatorId: string;
  centerLat: number;
  centerLng: number;
  title: string;
  body: string;
  url: string;
  data?: Record<string, any>;
}) {
  if (centerLat == null || centerLng == null || isNaN(centerLat) || isNaN(centerLng)) return;

  const supabase = createAdminClient();

  // Query all registered users
  const { data: users } = await supabase
    .from("users")
    .select("id, home_lat, home_lng, office_lat, office_lng");

  if (!users || users.length === 0) return;

  const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const matchedUserIds = new Set<string>();

  for (const u of users) {
    if (u.id === creatorId) continue;

    let isMatch = false;

    if (u.home_lat != null && u.home_lng != null) {
      const distHome = haversineMeters(centerLat, centerLng, Number(u.home_lat), Number(u.home_lng));
      if (distHome <= 2000) isMatch = true;
    }

    if (!isMatch && u.office_lat != null && u.office_lng != null) {
      const distOffice = haversineMeters(centerLat, centerLng, Number(u.office_lat), Number(u.office_lng));
      if (distOffice <= 2000) isMatch = true;
    }

    // If user has no location configured at all, include them so they receive neighborhood updates
    if (!isMatch && u.home_lat == null && u.home_lng == null && u.office_lat == null && u.office_lng == null) {
      isMatch = true;
    }

    if (isMatch) {
      matchedUserIds.add(u.id);
    }
  }

  console.log(`Notifying ${matchedUserIds.size} users within 2km of (${centerLat}, ${centerLng}) for: ${title}`);
  for (const targetId of matchedUserIds) {
    sendNotification(targetId, { title, body, url, data }).catch(err => console.error("Failed to notify user:", targetId, err));
  }
}


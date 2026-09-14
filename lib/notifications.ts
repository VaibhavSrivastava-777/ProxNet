/* eslint-disable @typescript-eslint/no-explicit-any */
import { fcmMessaging } from "./firebase-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function sendNotification(
  userId: string,
  { title, body, url, data }: { title: string; body: string; url: string; data?: Record<string, any> }
) {
  const supabase = createAdminClient();

  // 0. Persist to in_app_notifications table
  const { error: insertError } = await supabase
    .from("in_app_notifications")
    .insert({
      user_id: userId,
      title,
      body,
      url
    });

  if (insertError) {
    console.error("Failed to insert in-app notification:", insertError);
  }

  // 1. Fetch user's FCM tokens
  const { data: fcmTokens, error: fcmError } = await supabase
    .from("fcm_tokens")
    .select("*")
    .eq("user_id", userId);

  if (fcmError) {
    console.error("Failed to fetch FCM tokens for user:", userId, fcmError);
  }

  // 2. Dispatch FCM notifications
  if (fcmMessaging && fcmTokens && fcmTokens.length > 0) {
    console.log(`Sending FCM to ${fcmTokens.length} active devices for user ${userId}...`);
    
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
            title,
            body,
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
                  title,
                  body,
                },
                sound: "default",
                badge: 1,
              },
            },
          },
        });
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

  // 3. Send Email Notification via Resend (Fallback for users without FCM or for priority reminders)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    const hasFcmTokens = fcmTokens && fcmTokens.length > 0;
    const notifType = String(data?.type || "general");
    const isPriorityNotification =
      data?.forceEmail === true ||
      notifType === "profile_reminder" ||
      notifType === "complete_profile" ||
      notifType === "enable_notifications" ||
      notifType === "push_enable_reminder" ||
      notifType === "chat_starter_reminder" ||
      notifType === "starter_reminder" ||
      notifType.startsWith("job_match") ||
      notifType.startsWith("weekly_digest") ||
      notifType.startsWith("daily_engagement") ||
      notifType.startsWith("event_") ||
      notifType === "referral_network_nudge" ||
      notifType === "referral_request";

    // Dispatch email if user has no active FCM push tokens (crucial fallback), or for priority reminders
    if (!hasFcmTokens || isPriorityNotification) {
      const { checkEmailRateLimit, recordEmailSent, generateContextEmail } = await import("@/lib/email-templates");

      // Anti-spam gate check
      const rateCheck = checkEmailRateLimit(userId, notifType, data?.forceEmail === true);
      if (!rateCheck.allowed) {
        console.log(`[Anti-Spam] Suppressed email to ${userId} (${notifType}): ${rateCheck.reason}`);
        return;
      }

      const { data: user, error: uError } = await supabase
        .from("users")
        .select("email, full_name")
        .eq("id", userId)
        .single();

      if (uError || !user || !user.email) {
        console.warn("Could not retrieve user email or email is blank for ID:", userId);
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
          .limit(5);

        if (recentUnread && recentUnread.length > 1) {
          // Exclude the notification we just inserted
          otherUnreadNotifs = recentUnread.filter((n) => n.title !== title || n.url !== url).slice(0, 3);
        }
      } catch (err) {
        console.warn("Failed to fetch other unread notifications for email clubbing:", err);
      }

      try {
        const recipientName = user.full_name?.split(" ")[0] || "Neighbor";
        const emailContent = generateContextEmail({
          recipientName,
          recipientEmail: user.email,
          title,
          body,
          url,
          data,
          otherUnreadNotifs,
        });

        console.log(`[Resend] Sending ${emailContent.category} notification email to ${user.email} (${emailContent.subject})...`);
        const fromEmail = process.env.RESEND_FROM_EMAIL || "notifications@proxnet.in";

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `ProxNet <${fromEmail}>`,
            to: user.email,
            subject: emailContent.subject,
            html: emailContent.html,
          }),
          next: { revalidate: 0 },
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          const errorText = errorData ? JSON.stringify(errorData) : await res.text().catch(() => "Unknown error");
          if (res.status === 403 && (errorData?.message?.includes("verify a domain") || errorData?.message?.includes("testing emails"))) {
            console.warn(`[Resend Sandbox Notice] Recipient ${user.email} requires verified domain at resend.com/domains.`);
          } else {
            console.error("[Resend] Email delivery failed:", errorText);
          }
        } else {
          console.log(`[Resend] Notification email successfully delivered to ${user.email}.`);
          recordEmailSent(userId, notifType);

          // Best-effort audit logging into email_notifications_log if table exists
          Promise.resolve(
            supabase.from("email_notifications_log").insert({
              user_id: userId,
              notification_type: notifType,
              subject: emailContent.subject,
              recipient_email: user.email,
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


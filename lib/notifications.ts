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
    const isPriorityNotification =
      data?.forceEmail === true ||
      data?.type === "profile_reminder" ||
      data?.type === "starter_reminder" ||
      data?.type === "job_match" ||
      data?.type === "daily_engagement" ||
      data?.type === "event_reminder";

    // Dispatch email if user has no active FCM push tokens (crucial fallback), or for priority reminders
    if (!hasFcmTokens || isPriorityNotification) {
      const { data: user, error: uError } = await supabase
        .from("users")
        .select("email, full_name")
        .eq("id", userId)
        .single();

      if (uError || !user || !user.email) {
        console.warn("Could not retrieve user email or email is blank for ID:", userId);
        return;
      }

      try {
        console.log(`[Resend] Sending notification email to ${user.email} (${title})...`);
        const fromEmail = process.env.RESEND_FROM_EMAIL || "notifications@proxnet.in";
        const actionUrl = url?.startsWith("http") ? url : `https://www.proxnet.in${url || "/"}`;
        const recipientName = user.full_name?.split(" ")[0] || "Neighbor";

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `ProxNet <${fromEmail}>`,
            to: user.email,
            subject: title,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 12px; color: #1e293b;">
                <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                  <!-- Header -->
                  <div style="background: linear-gradient(135deg, #0A66C2 0%, #004182 100%); padding: 24px 28px; text-align: left;">
                    <span style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Prox<span style="color: #60a5fa;">Net</span></span>
                    <span style="display: block; font-size: 13px; color: #bfdbfe; margin-top: 4px;">Hyperlocal Professional Community</span>
                  </div>

                  <!-- Content Body -->
                  <div style="padding: 28px;">
                    <p style="font-size: 15px; color: #64748b; margin-top: 0;">Hi ${recipientName},</p>
                    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 4px; margin-bottom: 12px; line-height: 1.4;">${title}</h2>
                    
                    <div style="background-color: #f1f5f9; border-left: 4px solid #0A66C2; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0;">${body}</p>
                    </div>

                    <!-- Call To Action -->
                    <div style="text-align: center; margin: 28px 0 20px 0;">
                      <a href="${actionUrl}" style="background-color: #0A66C2; color: #ffffff; padding: 13px 28px; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(10, 102, 194, 0.25);">
                        Open in ProxNet &rarr;
                      </a>
                    </div>

                    <!-- Push Notification Conversion Tip -->
                    <div style="margin-top: 28px; padding: 14px 16px; background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%); border-radius: 12px; border: 1px solid #dbeafe;">
                      <p style="margin: 0; font-size: 13px; color: #1e40af; font-weight: 600;">
                        💡 Want instant alerts without checking your email?
                      </p>
                      <p style="margin: 4px 0 0 0; font-size: 12px; color: #475569; line-height: 1.4;">
                        Enable lock-screen push notifications on ProxNet to never miss a message, and receive 5 bonus wallet credits!
                      </p>
                    </div>
                  </div>

                  <!-- Footer -->
                  <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; text-align: center; font-size: 12px; color: #94a3b8;">
                    <p style="margin: 0;">This email was sent to ${user.email} because of your activity on ProxNet.</p>
                    <p style="margin: 4px 0 0 0;"><a href="https://www.proxnet.in/profile" style="color: #64748b; text-decoration: underline;">Manage notification preferences</a> &bull; <a href="https://www.proxnet.in" style="color: #64748b; text-decoration: underline;">proxnet.in</a></p>
                  </div>
                </div>
              </body>
              </html>
            `,
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


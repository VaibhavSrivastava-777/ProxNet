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
    for (const tokenRecord of fcmTokens) {
      try {
        await fcmMessaging.send({
          token: tokenRecord.token,
          notification: {
            title,
            body,
          },
          webpush: {
            fcmOptions: {
              link: `https://www.proxnet.in${url}`,
            },
            notification: {
              icon: "/logo.png",
              badge: "/icons/icon-96.png",
              data: { url, ...data },
              actions: [
                { action: "reply", title: "Reply", type: "text", placeholder: "Type a reply..." } as any
              ]
            },
          },
          android: {
            priority: "high",
            notification: {
              channelId: "proxnet_messages",
              sound: "default",
              icon: "@mipmap/ic_launcher",
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

  // 3. Send Email Notification (Phase 2)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
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
      console.log(`Sending notification email to ${user.email}...`);
      const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
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
            <div style="font-family: sans-serif; padding: 20px; max-width: 580px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
              <h2 style="color: #0A66C2; margin-top: 0;">ProxNet Notification</h2>
              <p style="font-size: 16px; color: #191919; line-height: 1.5;">${body}</p>
              <div style="margin-top: 24px;">
                <a href="https://proxnet.vercel.app${url}" style="background-color: #0A66C2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 9999px; font-weight: bold; display: inline-block;">
                  Open ProxNet
                </a>
              </div>
              <hr style="border: 0; border-top: 1px solid #eaeaea; margin-top: 30px; margin-bottom: 20px;" />
              <p style="font-size: 12px; color: #999;">This is an automated notification from ProxNet.</p>
            </div>
          `,
        }),
        next: { revalidate: 0 },
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Resend API email send failure:", errorText);
      } else {
        console.log("Email sent successfully via Resend.");
      }
    } catch (emailErr) {
      console.error("Error sending notification email via Resend:", emailErr);
    }
  }
}

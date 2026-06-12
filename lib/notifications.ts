import webPush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Initialize VAPID Details
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.NEXT_PUBLIC_VAPID_SUBJECT || "mailto:your-email@example.com";

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
} else {
  console.warn("VAPID Keys not fully configured. Web Push notifications will be disabled.");
}

export async function sendNotification(
  userId: string,
  { title, body, url }: { title: string; body: string; url: string }
) {
  const supabase = createAdminClient();

  // 1. Fetch user's push subscriptions
  const { data: subscriptions, error: sError } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);

  if (sError) {
    console.error("Failed to fetch push subscriptions for user:", userId, sError);
  }

  const payload = JSON.stringify({
    title,
    body,
    icon: "/logo.png",
    data: { url },
  });

  // 2. Dispatch Web Push notifications
  if (subscriptions && subscriptions.length > 0 && vapidPublicKey && vapidPrivateKey) {
    console.log(`Sending Web Push to ${subscriptions.length} active endpoints for user ${userId}...`);
    for (const sub of subscriptions) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webPush.sendNotification(pushSubscription, payload);
      } catch (err: any) {
        console.error("Web Push delivery failed for endpoint:", sub.endpoint, err.statusCode);
        // If the subscription is expired or unsubscribed, remove it from the DB
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log("Subscription expired/unsubscribed. Cleaning up database record...");
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
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

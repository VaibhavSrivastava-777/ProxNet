import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fcmMessaging } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "Missing email parameter" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, email, full_name")
    .eq("email", email)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: "User not found in database", details: userError }, { status: 404 });
  }

  const { data: tokens, error: tokensError } = await supabase
    .from("fcm_tokens")
    .select("*")
    .eq("user_id", user.id);

  if (tokensError) {
    return NextResponse.json({ error: "Failed to fetch FCM tokens", details: tokensError }, { status: 500 });
  }

  if (!fcmMessaging) {
    return NextResponse.json({
      error: "Firebase Admin SDK not initialized on server (fcmMessaging is null). Check server env variables.",
      envKeysPresent: {
        FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
        FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
        FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
      }
    }, { status: 500 });
  }

  const results: any[] = [];

  for (const tokenRecord of tokens || []) {
    try {
      const responseId = await fcmMessaging.send({
        token: tokenRecord.token,
        notification: {
          title: "ProxNet Diagnostics",
          body: "Verification message sent via diagnose-push endpoint.",
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
      results.push({
        token: tokenRecord.token,
        platform: tokenRecord.platform,
        success: true,
        messageId: responseId,
      });
    } catch (err: any) {
      results.push({
        token: tokenRecord.token,
        platform: tokenRecord.platform,
        success: false,
        error: {
          message: err.message,
          code: err.code,
          stack: err.stack,
        }
      });
    }
  }

  return NextResponse.json({
    userId: user.id,
    fullName: user.full_name,
    tokensFoundCount: tokens?.length || 0,
    results,
  });
}

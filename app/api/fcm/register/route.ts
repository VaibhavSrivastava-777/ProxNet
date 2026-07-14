import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { token, platform = "web" } = await request.json();
    if (!token) {
      return NextResponse.json({ error: "Missing FCM token" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Upsert registration token for the user
    const { data, error } = await supabase
      .from("fcm_tokens")
      .upsert(
        {
          user_id: user.id,
          token,
          platform,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,token" }
      )
      .select("*");

    if (error) {
      console.error("Database FCM token upsert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data?.[0] });
  } catch (err: any) {
    console.error("FCM registration API error:", err);
    return NextResponse.json({ error: err.message || "Failed to register FCM token" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: "Missing FCM token" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("fcm_tokens")
      .delete()
      .eq("user_id", user.id)
      .eq("token", token);

    if (error) {
      console.error("Database FCM token delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("FCM token deletion API error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete FCM token" }, { status: 500 });
  }
}

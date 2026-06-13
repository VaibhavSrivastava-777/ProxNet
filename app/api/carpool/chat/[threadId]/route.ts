import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ threadId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = await params;
  const supabase = createAdminClient();

  // Verify participant
  const { data: participant } = await supabase
    .from("carpool_participants")
    .select("alias, user_id")
    .eq("thread_id", threadId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!participant) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  const { data: thread } = await supabase
    .from("carpool_threads")
    .select("status")
    .eq("id", threadId)
    .single();

  const { data: rawMessages } = await supabase
    .from("carpool_messages")
    .select("*, sender:users!carpool_messages_sender_id_fkey(id)")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  const { data: aliases } = await supabase
    .from("carpool_participants")
    .select("user_id, alias")
    .eq("thread_id", threadId);

  const aliasMap: Record<string, string> = {};
  if (aliases) {
    for (const a of aliases) aliasMap[a.user_id] = a.alias;
  }

  const messages = (rawMessages || []).map((m: any) => ({
    id: m.id,
    body: m.body,
    created_at: m.created_at,
    isOwn: m.sender_id === user.id,
    alias: aliasMap[m.sender_id] || "Anonymous"
  }));

  let otherPhone = "";
  if (thread?.status === "revealed") {
    // get other participant's phone number
    const otherUserId = aliases?.find(a => a.user_id !== user.id)?.user_id;
    if (otherUserId) {
      const { data: otherUser } = await supabase.from("users").select("phone_number").eq("id", otherUserId).single();
      if (otherUser) otherPhone = otherUser.phone_number || "";
    }
  }

  return NextResponse.json({
    messages,
    myAlias: participant.alias,
    status: thread?.status || "active",
    myPhone: user.phone_number || "",
    otherPhone
  });
}

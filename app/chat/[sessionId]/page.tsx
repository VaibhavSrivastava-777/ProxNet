export const unstable_instant = false;

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { ChatRoom } from "@/components/chat/ChatRoom";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { sessionId } = await params;

  return <ChatRoom sessionId={sessionId} />;
}

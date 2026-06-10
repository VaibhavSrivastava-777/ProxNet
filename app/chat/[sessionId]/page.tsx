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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Anonymous chat</h1>
      <ChatRoom sessionId={sessionId} />
    </div>
  );
}

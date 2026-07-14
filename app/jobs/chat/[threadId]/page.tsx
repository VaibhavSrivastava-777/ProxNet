export const unstable_instant = false;

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { JobChatRoom } from "@/components/jobs/JobChatRoom";

export default async function JobChatPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl py-4 h-[calc(100vh-var(--nav-height))] flex flex-col">
      <JobChatRoom threadId={threadId} userId={user.id} />
    </div>
  );
}

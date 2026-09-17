export const unstable_instant = false;

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { JobChatRoom } from "@/components/jobs/JobChatRoom";

export default async function JobChatPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <JobChatRoom threadId={threadId} userId={user.id} />;
}

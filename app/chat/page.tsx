import { redirect } from "next/navigation";

interface ChatPageProps {
  searchParams: Promise<{ user?: string; userId?: string }>;
}

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const params = await searchParams;
  const targetUser = params?.user || params?.userId;

  if (targetUser) {
    redirect(`/network?userId=${encodeURIComponent(targetUser)}`);
  }

  redirect("/qa");
}

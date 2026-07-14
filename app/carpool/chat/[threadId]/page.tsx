export const unstable_instant = false;

import { auth } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { CarpoolChatRoom } from "@/components/carpool/CarpoolChatRoom";
import Link from "next/link";

export const metadata = {
  title: "Carpool Chat - ProxNet",
};

export default async function CarpoolChatPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 lg:py-8 h-full animate-fadeInUp">
      <div className="mb-2">
        <Link
          href="/carpool"
          className="text-sm font-medium text-[var(--color-primary)] hover:underline flex items-center gap-1 w-fit"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Matches
        </Link>
      </div>

      <CarpoolChatRoom threadId={threadId} />
    </div>
  );
}

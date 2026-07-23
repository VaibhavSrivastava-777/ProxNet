import { auth } from "@/lib/auth";
import { findUserById } from "@/lib/users";
import { BlockedUserScreen } from "@/components/BlockedUserScreen";

export async function BlockUserWrapper({ children }: { children: React.ReactNode }) {
  const session = await auth();
  
  if (session?.user?.id) {
    const user = await findUserById(session.user.id);
    if (user?.is_blocked) {
      return <BlockedUserScreen />;
    }
  }

  return <>{children}</>;
}

import { auth } from "./auth";
import { findUserByLinkedInSub, ensureAdminUser } from "./users";
import { getAdminSession } from "./admin-session";
import type { User } from "./types";

export async function getCurrentUser(): Promise<User | null> {
  const session = await auth();
  if (session?.user?.linkedinSub) {
    return findUserByLinkedInSub(session.user.linkedinSub);
  }
  
  const adminSession = await getAdminSession();
  if (adminSession) {
    return ensureAdminUser();
  }

  return null;
}

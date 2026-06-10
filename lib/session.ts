import { auth } from "./auth";
import { findUserByLinkedInSub } from "./users";
import type { User } from "./types";

export async function getCurrentUser(): Promise<User | null> {
  const session = await auth();
  if (!session?.user?.linkedinSub) return null;
  return findUserByLinkedInSub(session.user.linkedinSub);
}

import { auth } from "./auth";
import { findUserByLinkedInSub, findUserById, findUserByEmail, ensureAdminUser, ensureNonAdminUser } from "./users";
import { getAdminSession, getNonAdminSession } from "./admin-session";
import { createAdminClient } from "./supabase/admin";
import { isSupabaseConfigured } from "./supabase/is-configured";
import type { User } from "./types";

export async function getCurrentUser(): Promise<User | null> {
  const session = await auth();
  if (session?.user) {
    let user: User | null = null;
    if (session.user.linkedinSub) {
      user = await findUserByLinkedInSub(session.user.linkedinSub);
    }
    if (!user && (session.user as any).id) {
      user = await findUserById((session.user as any).id);
    }
    if (!user && session.user.email) {
      user = await findUserByEmail(session.user.email);
    }

    if (user) {
      // Sync OAuth picture (Google or LinkedIn) to user profile if missing
      const oauthPicture = session.user.image || (session.user as any).picture;
      if (!user.profile_photo_url && oauthPicture) {
        user.profile_photo_url = oauthPicture;
        if (isSupabaseConfigured()) {
          try {
            const supabase = createAdminClient();
            Promise.resolve(
              supabase.from("users").update({ profile_photo_url: oauthPicture }).eq("id", user.id)
            ).catch(() => {});
          } catch {
            // ignore async sync errors
          }
        }
      }
      return user;
    }
  }
  
  const adminSession = await getAdminSession();
  if (adminSession) {
    return ensureAdminUser();
  }

  const nonAdminSession = await getNonAdminSession();
  if (nonAdminSession) {
    return ensureNonAdminUser();
  }

  return null;
}

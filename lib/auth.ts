import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { findUserByLinkedInSub, upsertOAuthUser } from "./users";

// Google is the only sign-in provider. The `linkedin_sub` column and
// `linkedinSub` session field now hold the Google subject ID (legacy names kept
// to avoid a wider refactor; see users.ts for how existing accounts are matched).
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      id: "google-native",
      name: "Google Native Token",
      credentials: {
        idToken: { label: "ID Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.idToken) return null;
        try {
          const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credentials.idToken}`);
          if (!res.ok) return null;
          const payload = await res.json();
          return {
            id: payload.sub,
            name: payload.name,
            email: payload.email,
            image: payload.picture,
          };
        } catch (e) {
          console.error("Error verifying native Google ID Token:", e);
          return null;
        }
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "development-secret-key-for-nextauth-verification",
  callbacks: {
    async signIn({ account, user, profile }) {
      const isCredentials = account?.provider === "credentials";
      const sub = isCredentials ? user?.id : account?.providerAccountId;
      if (!sub) return false;

      // Read referrer code from cookie (set by /join/[code] invite landing page)
      let referrerCode: string | null = null;
      try {
        const cookieStore = await cookies();
        referrerCode = cookieStore.get("proxnet_ref")?.value ?? null;
      } catch {
        // cookies() may not be available in all contexts
      }

      const u = user as {
        name?: string | null;
        email?: string | null;
        image?: string | null;
      };

      const prof = profile as Record<string, any> | undefined;
      const picture = u.image || prof?.picture || null;

      const dbUser = await upsertOAuthUser({
        sub: sub,
        email: u.email || prof?.email || null,
        name: u.name || prof?.name || null,
        picture: picture,
        referrerCode,
      });
      return !!dbUser;
    },
    async jwt({ token, account, user, profile }) {
      if (account?.provider === "credentials" && user?.id) {
        token.linkedinSub = user.id;
      } else if (account?.providerAccountId) {
        token.linkedinSub = account.providerAccountId;
      }
      if (profile) {
        const p = profile as { sub?: string };
        if (p.sub) token.linkedinSub = p.sub;
      }
      if (token.linkedinSub) {
        const dbUser = await findUserByLinkedInSub(token.linkedinSub as string);
        if (dbUser) token.userId = dbUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.linkedinSub) {
        session.user.linkedinSub = token.linkedinSub as string;
      }
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  trustHost: true,
});

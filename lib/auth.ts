import NextAuth from "next-auth";
import LinkedIn from "next-auth/providers/linkedin";
import { findUserByLinkedInSub, upsertOAuthUser } from "./users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    LinkedIn({
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
      authorization: {
        params: { scope: "openid profile email" },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (!account?.providerAccountId) return false;
      const p = profile as {
        sub?: string;
        email?: string;
        name?: string;
        picture?: string;
      };
      const user = await upsertOAuthUser({
        sub: account.providerAccountId,
        email: p.email ?? null,
        name: p.name ?? null,
        picture: p.picture ?? null,
      });
      return !!user;
    },
    async jwt({ token, account, profile }) {
      if (account?.providerAccountId) {
        token.linkedinSub = account.providerAccountId;
      }
      if (profile) {
        const p = profile as { sub?: string };
        if (p.sub) token.linkedinSub = p.sub;
      }
      if (token.linkedinSub) {
        const user = await findUserByLinkedInSub(token.linkedinSub as string);
        if (user) token.userId = user.id;
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

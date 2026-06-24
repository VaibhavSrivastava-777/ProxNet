import NextAuth from "next-auth";
import LinkedIn from "next-auth/providers/linkedin";
import { findUserByLinkedInSub, upsertOAuthUser } from "./users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    LinkedIn({
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
      authorization: {
        params: { scope: "openid profile email r_profile_basicinfo" },
      },
      async profile(profile, tokens) {
        let name = profile.name;
        let picture = profile.picture;
        let headline = "";
        let profileUrl = "";

        if (tokens.access_token) {
          try {
            const res = await fetch("https://api.linkedin.com/rest/identityMe", {
              headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                "LinkedIn-Version": "202401",
              },
            });
            if (res.ok) {
              const data = await res.json();
              if (data.basicInfo) {
                const b = data.basicInfo;
                if (b.firstName && b.lastName) {
                  name = `${b.firstName} ${b.lastName}`;
                }
                if (b.profilePictureUrl) {
                  picture = b.profilePictureUrl;
                } else if (b.pictureUrl) {
                  picture = b.pictureUrl;
                } else if (b.profilePicture) {
                  if (typeof b.profilePicture === "string") {
                    picture = b.profilePicture;
                  }
                }
                if (b.profileUrl) {
                  profileUrl = b.profileUrl;
                } else if (b.publicProfileUrl) {
                  profileUrl = b.publicProfileUrl;
                } else if (b.vanityName) {
                  profileUrl = `https://www.linkedin.com/in/${b.vanityName}`;
                } else if (data.vanityName) {
                  profileUrl = `https://www.linkedin.com/in/${data.vanityName}`;
                }
                if (b.headline) {
                  headline = b.headline;
                }
              }
            }
          } catch (e) {
            console.error("Error fetching identityMe:", e);
          }
        }

        return {
          id: profile.sub,
          name,
          email: profile.email,
          image: picture,
          headline,
          profileUrl,
        };
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "development-secret-key-for-nextauth-verification",
  callbacks: {
    async signIn({ account, user }) {
      if (!account?.providerAccountId) return false;
      const u = user as {
        name?: string | null;
        email?: string | null;
        image?: string | null;
        headline?: string | null;
        profileUrl?: string | null;
      };
      const dbUser = await upsertOAuthUser({
        sub: account.providerAccountId,
        email: u.email ?? null,
        name: u.name ?? null,
        picture: u.image ?? null,
        linkedinProfileUrl: u.profileUrl ?? null,
        headline: u.headline ?? null,
      });
      return !!dbUser;
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

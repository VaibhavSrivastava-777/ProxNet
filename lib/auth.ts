import NextAuth from "next-auth";
import LinkedIn from "next-auth/providers/linkedin";
import Google from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
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
    async signIn({ account, user }) {
      const isCredentials = account?.provider === "credentials";
      const sub = isCredentials ? user?.id : account?.providerAccountId;
      if (!sub) return false;

      const u = user as {
        name?: string | null;
        email?: string | null;
        image?: string | null;
        headline?: string | null;
        profileUrl?: string | null;
      };
      const dbUser = await upsertOAuthUser({
        sub: sub,
        email: u.email ?? null,
        name: u.name ?? null,
        picture: u.image ?? null,
        linkedinProfileUrl: u.profileUrl ?? null,
        headline: u.headline ?? null,
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

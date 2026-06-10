import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      linkedinSub?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    linkedinSub?: string;
    userId?: string;
  }
}

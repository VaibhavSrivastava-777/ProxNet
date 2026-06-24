import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "admin_session";
const MAX_AGE = 60 * 60 * 8;

function getSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required");
  return new TextEncoder().encode(secret);
}

export async function createAdminSession(adminId: string, suId: string) {
  const token = await new SignJWT({ adminId, suId, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getAdminSession(): Promise<{ adminId: string; suId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.role !== "admin") return null;
    return { adminId: payload.adminId as string, suId: payload.suId as string };
  } catch {
    return null;
  }
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function createNonAdminSession(userId: string, suId: string) {
  const token = await new SignJWT({ userId, suId, role: "user" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set("non_admin_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getNonAdminSession(): Promise<{ userId: string; suId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("non_admin_session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.role !== "user") return null;
    return { userId: payload.userId as string, suId: payload.suId as string };
  } catch {
    return null;
  }
}

export async function clearNonAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete("non_admin_session");
}

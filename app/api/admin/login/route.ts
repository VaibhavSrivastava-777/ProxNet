import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { createAdminSession, createNonAdminSession } from "@/lib/admin-session";

function tryDevLogin(suID: string, suPWD: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const devId = process.env.ADMIN_SU_ID;
  const devPwd = process.env.ADMIN_SU_PWD;
  return Boolean(devId && devPwd && suID === devId && suPWD === devPwd);
}

function tryDevNonAdminLogin(suID: string, suPWD: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const devId = process.env.NON_ADMIN_ID;
  const devPwd = process.env.NON_ADMIN_PWD;
  return Boolean(devId && devPwd && suID === devId && suPWD === devPwd);
}

export async function POST(request: Request) {
  const { suID, suPWD } = await request.json();
  if (!suID || !suPWD) {
    return NextResponse.json({ error: "Credentials required" }, { status: 400 });
  }

  if (tryDevNonAdminLogin(suID, suPWD)) {
    await createNonAdminSession("dev-user", suID);
    return NextResponse.json({ ok: true, mode: "dev-user" });
  }

  if (!isSupabaseConfigured()) {
    if (tryDevLogin(suID, suPWD)) {
      await createAdminSession("dev-admin", suID);
      return NextResponse.json({ ok: true, mode: "dev" });
    }
    return NextResponse.json(
      {
        error: "Database not configured",
        message:
          "Set Supabase keys in .env.local and run npm run seed:admin, or use ADMIN_SU_ID / ADMIN_SU_PWD from .env.local in development.",
        code: "DB_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  try {
    const supabase = createAdminClient();
    const { data: admin, error } = await supabase
      .from("admin_credentials")
      .select("*")
      .eq("su_id", suID)
      .maybeSingle();

    if (error) {
      console.error("Admin login DB error:", error);
      if (tryDevLogin(suID, suPWD)) {
        await createAdminSession("dev-admin", suID);
        return NextResponse.json({ ok: true, mode: "dev" });
      }
      return NextResponse.json(
        {
          error: "Database error",
          message:
            "Could not reach Supabase. Check your keys, run the migration SQL, then npm run seed:admin.",
          code: "DB_ERROR",
        },
        { status: 503 }
      );
    }

    if (!admin) {
      if (tryDevLogin(suID, suPWD)) {
        await createAdminSession("dev-admin", suID);
        return NextResponse.json({ ok: true, mode: "dev" });
      }
      return NextResponse.json(
        {
          error: "Invalid credentials",
          message: "No admin account found. Run: npm run seed:admin",
          code: "ADMIN_NOT_SEEDED",
        },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(suPWD, admin.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    await createAdminSession(admin.id, admin.su_id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin login error:", err);
    if (tryDevLogin(suID, suPWD)) {
      await createAdminSession("dev-admin", suID);
      return NextResponse.json({ ok: true, mode: "dev" });
    }
    return NextResponse.json(
      { error: "Server error", message: "Admin login failed unexpectedly." },
      { status: 500 }
    );
  }
}

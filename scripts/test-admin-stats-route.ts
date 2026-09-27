import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { GET } from "../app/api/admin/dashboard-stats/route";

// mock admin session
jest_mock:
async function runTest() {
  process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "dummy";
  const { createAdminSession } = await import("../lib/admin-session");
  // Let's call the logic by testing the route directly or calling it with cookies
}

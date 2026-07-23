import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { handleBroadcast } from "@/lib/cronBroadcast";

export async function POST(request: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const fakeReq = new Request(`http://localhost${url.search}`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });

  return handleBroadcast(fakeReq);
}

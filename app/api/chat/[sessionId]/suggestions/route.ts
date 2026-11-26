import { connection } from "next/server";
import { NextResponse } from "next/server";

// AI suggestions in chat have been decommissioned per WhatsApp-grade UX requirements.
export async function GET() {
  await connection();
  return NextResponse.json({ suggestions: [] });
}

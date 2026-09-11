import { NextResponse } from "next/server";

// AI suggestions in chat have been decommissioned per WhatsApp-grade UX requirements.
export async function GET() {
  return NextResponse.json({ suggestions: [] });
}

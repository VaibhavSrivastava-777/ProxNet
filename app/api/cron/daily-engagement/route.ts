import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function GET(request: Request) {
  return handleDailyEngagement(request);
}

export async function POST(request: Request) {
  return handleDailyEngagement(request);
}

async function handleDailyEngagement(request: Request) {
  return NextResponse.json({ 
    success: true, 
    disabled: true, 
    message: "Daily re-engagement notifications have been removed as requested." 
  });
}

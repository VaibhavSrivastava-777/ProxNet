import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getScraper } from "@/lib/scrapers/registry";

export const maxDuration = 120; // 2 minutes

export async function POST(request: Request) {
  return NextResponse.json({ success: true, message: "Scraping dry-run is disabled." });
}

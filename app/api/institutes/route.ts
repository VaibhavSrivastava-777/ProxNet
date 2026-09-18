import { NextResponse } from "next/server";
import { getInstitutes } from "@/lib/institutes";

export async function GET() {
  try {
    const institutes = await getInstitutes();
    return NextResponse.json({ institutes });
  } catch (error: any) {
    console.error("Error in GET /api/institutes:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch institutes" }, { status: 500 });
  }
}

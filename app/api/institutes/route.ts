import { NextResponse } from "next/server";
import { getInstitutes, findOrCreateInstitute } from "@/lib/institutes";

export async function GET() {
  try {
    const institutes = await getInstitutes();
    return NextResponse.json({ institutes });
  } catch (error: any) {
    console.error("Error in GET /api/institutes:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch institutes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, category } = body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json({ error: "Institute name is required (minimum 2 characters)" }, { status: 400 });
    }

    const institute = await findOrCreateInstitute(name.trim(), category || "other");
    return NextResponse.json({ institute });
  } catch (error: any) {
    console.error("Error in POST /api/institutes:", error);
    return NextResponse.json({ error: error.message || "Failed to save institute" }, { status: 500 });
  }
}

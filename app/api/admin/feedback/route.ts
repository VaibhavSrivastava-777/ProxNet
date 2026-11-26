import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { body } = await request.json();
    console.log("Generic Quick Reply received from user : ", body);
    
    // In a real app, you might save this to an admin_feedback table.
    // For now, logging it is sufficient as we just want to ensure it succeeds.
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feedback error: ", error);
    return NextResponse.json({ error: "Failed to process feedback" }, { status: 500 });
  }
}

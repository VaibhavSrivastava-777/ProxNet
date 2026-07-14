import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { discoverAts } from "@/lib/ats-discovery";

export async function POST(request: Request) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { companyName } = await request.json();
    if (!companyName) {
      return NextResponse.json({ error: "Missing companyName" }, { status: 400 });
    }

    console.log(`Running helper discovery for: ${companyName}...`);
    const discovery = await discoverAts(companyName);
    
    if (!discovery) {
      return NextResponse.json({ 
        error: `Could not auto-discover job board for "${companyName}". Please configure manually.` 
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      provider: discovery.provider,
      boardToken: discovery.board
    });
  } catch (e: any) {
    console.error(`[Discovery Error] Failed to discover ATS:`, e);
    return NextResponse.json({ 
      error: `Discovery failed: ${e.message || e}` 
    }, { status: 500 });
  }
}

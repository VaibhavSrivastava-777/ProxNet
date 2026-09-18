import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getUserAffiliations, addAffiliation, deleteAffiliation } from "@/lib/institutes";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const affiliations = await getUserAffiliations(user.id);
    return NextResponse.json({ affiliations });
  } catch (error: any) {
    console.error("Error in GET /api/profile/affiliations:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch affiliations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { institute_id, degree, batch_year } = body;

    if (!institute_id) {
      return NextResponse.json({ error: "Institute ID is required" }, { status: 400 });
    }

    const affiliation = await addAffiliation({
      userId: user.id,
      instituteId: institute_id,
      degree: degree || null,
      batchYear: batch_year ? Number(batch_year) : null,
      userEmail: user.email,
    });

    return NextResponse.json({ affiliation });
  } catch (error: any) {
    console.error("Error in POST /api/profile/affiliations:", error);
    return NextResponse.json({ error: error.message || "Failed to add affiliation" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    let affiliationId = searchParams.get("id");

    if (!affiliationId) {
      try {
        const body = await request.json();
        affiliationId = body?.id;
      } catch {
        // Body might be empty
      }
    }

    if (!affiliationId) {
      return NextResponse.json({ error: "Affiliation ID is required" }, { status: 400 });
    }

    const success = await deleteAffiliation(user.id, affiliationId);
    return NextResponse.json({ success });
  } catch (error: any) {
    console.error("Error in DELETE /api/profile/affiliations:", error);
    return NextResponse.json({ error: error.message || "Failed to delete affiliation" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { userIds } = body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: "No users provided" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const inserts = userIds.map((targetId: string) => ({
    job_post_id: id,
    invited_by: user.id,
    invited_user_id: targetId,
  }));

  const { error } = await supabase.from("job_post_invites").insert(inserts);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: userIds.length });
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { status } = body; // 'yes', 'no', 'maybe'

  if (!["yes", "no", "maybe"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Validate event exists
  const { data: event } = await supabase.from("events").select("id").eq("id", id).single();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  // Upsert RSVP
  const { data: rsvp, error } = await supabase
    .from("event_rsvps")
    .upsert(
      { 
        event_id: id, 
        user_id: user.id, 
        status, 
        updated_at: new Date().toISOString() 
      },
      { onConflict: 'event_id,user_id' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rsvp });
}

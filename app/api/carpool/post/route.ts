import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeGoogleRoute } from "@/lib/google-routes";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { type, start_name, start_lat, start_lng, dest_name, dest_lat, dest_lng, date, time_start, time_end, seats, is_recurring, recurring_days } = body;

  if (!type || !start_lat || !start_lng || !dest_lat || !dest_lng || !time_start || !time_end || !seats) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  
  if (!is_recurring && !date) {
    return NextResponse.json({ error: "Missing date for one-time trip" }, { status: 400 });
  }

  if (type !== "giver" && type !== "seeker") {
    return NextResponse.json({ error: "Invalid post type" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: existingPost } = await supabase
    .from("carpool_posts")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const route_polyline = await computeGoogleRoute(
    { lat: Number(start_lat), lng: Number(start_lng) },
    { lat: Number(dest_lat), lng: Number(dest_lng) }
  );

  const postData = {
    user_id: user.id,
    type,
    status: "active",
    start_name,
    start_lat,
    start_lng,
    dest_name,
    dest_lat,
    dest_lng,
    date,
    is_recurring: is_recurring || false,
    recurring_days: is_recurring ? recurring_days : null,
    time_start,
    time_end,
    seats,
    route_polyline,
  };

  let data, error;
  if (existingPost) {
    const res = await supabase.from("carpool_posts").update(postData).eq("id", existingPost.id).select("id").single();
    data = res.data;
    error = res.error;
  } else {
    const res = await supabase.from("carpool_posts").insert(postData).select("id").single();
    data = res.data;
    error = res.error;
  }

  if (error || !data) {
    console.error("Error creating/updating carpool post:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // --- AI Matchmaking Logic ---
  try {
    const { data: allUsers } = await supabase
      .from("users")
      .select("id, full_name, home_lat, home_lng, office_lat, office_lng")
      .neq("id", user.id)
      .not("home_lat", "is", null)
      .not("office_lat", "is", null);

    if (allUsers && allUsers.length > 0) {
      function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
        const R = 6371e3; const p = Math.PI / 180;
        const a = 0.5 - Math.cos((lat2 - lat1) * p) / 2 + Math.cos(lat1 * p) * Math.cos(lat2 * p) * (1 - Math.cos((lon2 - lon1) * p)) / 2;
        return R * 2 * Math.asin(Math.sqrt(a));
      }

      const matchedUsers = allUsers.filter(u => {
        const dStart = haversineDistance(start_lat, start_lng, u.home_lat, u.home_lng);
        const dEnd = haversineDistance(dest_lat, dest_lng, u.office_lat, u.office_lng);
        return dStart <= 2000 && dEnd <= 2000;
      });

      if (matchedUsers.length > 0) {
        // 1. Get or create AI user
        let { data: aiUser } = await supabase.from("users").select("id").eq("email", "ai@proxnet.com").maybeSingle();
        if (!aiUser) {
          const { data: newAi } = await supabase.from("users").insert({
            email: "ai@proxnet.com",
            full_name: "ProxNet AI",
            name: "ProxNet AI",
            job_title: "AI Agent",
            company: "ProxNet",
            is_admin: true,
            is_onboarded: true
          }).select("id").single();
          aiUser = newAi;
        }

        if (aiUser) {
          // Send 1x1 messages
          for (const match of matchedUsers) {
            // Create a thread between AI and Match
            const { data: thread } = await supabase.from("carpool_threads").insert({
              post_id: data.id,
              responder_post_id: data.id, // Mock
              status: "active"
            }).select("id").single();

            if (thread) {
              await supabase.from("carpool_participants").insert([
                { thread_id: thread.id, user_id: aiUser.id, alias: "ProxNet AI" },
                { thread_id: thread.id, user_id: match.id, alias: match.full_name || "Professional" }
              ]);

              const msgText = `Hi! ${user.full_name || "A professional"} is ${type === "giver" ? "driving" : "seeking a ride"} from ${start_name} to ${dest_name} around ${time_start}. This is right on your usual route! Would you like to connect with them?`;
              await supabase.from("carpool_messages").insert({
                thread_id: thread.id,
                sender_id: aiUser.id,
                content: msgText
              });
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("AI Matchmaking failed:", e);
  }
  // ----------------------------

  return NextResponse.json({ ok: true, id: data.id });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("carpool_posts")
    .update({ status: "expired" })
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

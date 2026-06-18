import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { haversineDistanceMeters } from "@/lib/geo/haversine";
import { resolveUserLocation } from "@/lib/anonymize";
import type { User } from "@/lib/types";
import { sendNotification } from "@/lib/notifications";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  const { data: asked } = await supabase
    .from("questions")
    .select("*, question_targets(status)")
    .eq("asker_id", user.id);

  const { data: targeted } = await supabase
    .from("question_targets")
    .select("*, questions(*, question_targets(status, professional_id))")
    .eq("professional_id", user.id);

  const { data: sessions } = await supabase
    .from("chat_sessions")
    .select("id, question_id, created_at, chat_messages(body, created_at, sender_id)");

  const sessionActivityMap = new Map<string, { time: string; body: string | null; sender_id: string | null }>();
  if (sessions) {
    for (const session of sessions) {
      if (!session.question_id) continue;
      let latestTime = session.created_at;
      let latestBody = null;
      let latestSender = null;
      
      if (session.chat_messages && session.chat_messages.length > 0) {
        const latestMsg = session.chat_messages.reduce((prev: any, current: any) => 
          (new Date(prev.created_at).getTime() > new Date(current.created_at).getTime()) ? prev : current
        );
        latestTime = latestMsg.created_at;
        latestBody = latestMsg.body;
        latestSender = latestMsg.sender_id;
      }
      
      const currentLatest = sessionActivityMap.get(session.question_id);
      if (!currentLatest || new Date(latestTime).getTime() > new Date(currentLatest.time).getTime()) {
        sessionActivityMap.set(session.question_id, { time: latestTime, body: latestBody, sender_id: latestSender });
      }
    }
  }

  const askedWithActivity = (asked ?? []).map((q) => {
    const activity = sessionActivityMap.get(q.id);
    return { 
      ...q, 
      latest_activity_at: activity?.time || q.created_at,
      latest_message_body: activity?.body || null,
      latest_message_sender: activity?.sender_id || null,
    };
  });
  askedWithActivity.sort((a, b) => new Date(b.latest_activity_at).getTime() - new Date(a.latest_activity_at).getTime());

  const filteredTargeted = (targeted ?? []).filter((t) => {
    if (t.status === "responded") return true;
    const qTargets = t.questions?.question_targets ?? [];
    const hasAnyOtherResponded = qTargets.some(
      (qt: any) => qt.status === "responded" && qt.professional_id !== user.id
    );
    return !hasAnyOtherResponded;
  });

  const incomingWithActivity = filteredTargeted.map((t) => {
    const q = t.questions;
    const activity = sessionActivityMap.get(q.id);
    return {
      id: q.id,
      body: q.body,
      status: t.status,
      company_filter: q.company_filter,
      title_filter: q.title_filter,
      created_at: q.created_at,
      asker_alias: `Resident-${q.asker_id.slice(0, 4)}`,
      target_id: t.id,
      latest_activity_at: activity?.time || q.created_at,
      latest_message_body: activity?.body || null,
      latest_message_sender: activity?.sender_id || null,
    };
  });
  incomingWithActivity.sort((a, b) => new Date(b.latest_activity_at).getTime() - new Date(a.latest_activity_at).getTime());

  // Fetch forum questions
  const { data: allForumQuestions } = await supabase
    .from("questions")
    .select("*, question_comments(id)")
    .eq("type", "forum")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: currentLocations } = await supabase.from("user_current_locations").select("*");
  const locationMap = new Map(
    (currentLocations ?? []).map((l) => [l.user_id, { lat: Number(l.lat), lng: Number(l.lng) }])
  );
  
  const myCurrent = locationMap.get(user.id);
  const myLoc = resolveUserLocation(user as User, myCurrent?.lat, myCurrent?.lng);

  const forumWithActivity = (allForumQuestions ?? []).filter(q => {
    if (!myLoc) return false;
    const dist = haversineDistanceMeters(q.center_lat, q.center_lng, myLoc.lat, myLoc.lng);
    return dist <= q.radius_meters;
  }).map(q => ({
    id: q.id,
    body: q.body,
    asker_alias: `Neighbor-${q.asker_id.slice(0, 4)}`,
    created_at: q.created_at,
    likes_count: q.likes_count || 0,
    comments_count: q.question_comments?.length || 0,
  }));

  let suggestions: any[] = [];
  if (myLoc && user.job_title) {
    const { data: allUsers } = await supabase
      .from("users")
      .select("id, full_name, company, job_title, profile_photo_url, home_lat, home_lng")
      .neq("id", user.id)
      .not("home_lat", "is", null);

    if (allUsers) {
      suggestions = allUsers.map((u: any) => {
         const dist = haversineDistanceMeters(myLoc.lat, myLoc.lng, u.home_lat, u.home_lng);
         let score = 0;
         if (u.job_title?.toLowerCase() === user.job_title?.toLowerCase()) score += 60;
         else if (u.job_title && user.job_title && (u.job_title.includes(user.job_title) || user.job_title.includes(u.job_title))) score += 30;
         
         if (u.company?.toLowerCase() === user.company?.toLowerCase()) score += 40;

         return {
            user: {
              id: u.id,
              company: u.company,
              job_title: u.job_title,
              full_name: u.full_name,
              profile_photo_url: u.profile_photo_url
            },
            score,
            distance: dist
         };
      }).filter(s => s.score > 0 && s.distance <= 5000).sort((a, b) => b.score - a.score).slice(0, 3);
    }
  }

  return NextResponse.json({
    asked: askedWithActivity,
    incoming: incomingWithActivity,
    forum: forumWithActivity,
    suggestions,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    questionBody,
    companyFilter,
    titleFilter,
    centerLat,
    centerLng,
    radiusMeters,
  } = body;

  if (!questionBody?.trim()) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const isForum = !companyFilter && !titleFilter;

  const { data: question, error: qError } = await supabase
    .from("questions")
    .insert({
      asker_id: user.id,
      body: questionBody.trim(),
      company_filter: companyFilter || null,
      title_filter: titleFilter || null,
      center_lat: centerLat,
      center_lng: centerLng,
      radius_meters: radiusMeters ?? 100,
      type: isForum ? "forum" : "direct",
    })
    .select("*")
    .single();

  if (qError) return NextResponse.json({ error: qError.message }, { status: 500 });

  if (!isForum) {
    const { data: users } = await supabase.from("users").select("*").eq("is_active", true).neq("id", user.id);
    const { data: currentLocations } = await supabase.from("user_current_locations").select("*");
    const locationMap = new Map(
      (currentLocations ?? []).map((l) => [l.user_id, { lat: Number(l.lat), lng: Number(l.lng) }])
    );

    const targets: { question_id: string; professional_id: string }[] = [];

    for (const u of (users ?? []) as User[]) {
      if (companyFilter && u.company?.toLowerCase() !== companyFilter.toLowerCase()) continue;
      if (titleFilter && u.job_title?.toLowerCase() !== titleFilter.toLowerCase()) continue;

      const current = locationMap.get(u.id);
      const loc = resolveUserLocation(u, current?.lat, current?.lng);
      if (!loc) continue;

      const distance = haversineDistanceMeters(centerLat, centerLng, loc.lat, loc.lng);
      if (distance <= (radiusMeters ?? 100)) {
        targets.push({ question_id: question.id, professional_id: u.id });
      }
    }

    if (targets.length > 0) {
      await supabase.from("question_targets").insert(targets);

      // Notify targeted professionals
      try {
        const notifications = targets.map((t) =>
          sendNotification(t.professional_id, {
            title: "New Incoming Question",
            body: `A neighbor asked a question: "${question.body.slice(0, 60)}${question.body.length > 60 ? "..." : ""}"`,
            url: "/qa",
          })
        );
        await Promise.all(notifications);
      } catch (err) {
        console.error("Bulk notifications trigger error:", err);
      }
    }
    return NextResponse.json({ question, targetCount: targets.length });
  }

  return NextResponse.json({ question, targetCount: 0 });
}

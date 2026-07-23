import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { haversineDistanceMeters } from "@/lib/geo/haversine";
import { resolveUserLocation, generateAlias } from "@/lib/anonymize";
import type { User } from "@/lib/types";
import { sendNotification } from "@/lib/notifications";
import { awardPoints } from "@/lib/award-points";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const locationMode = searchParams.get("locationMode") || "home";

  const supabase = createAdminClient();

  // Load locations and coordinates first
  const { data: currentLocations } = await supabase.from("user_current_locations").select("*");
  const locationMap = new Map(
    (currentLocations ?? []).map((l) => [l.user_id, { lat: Number(l.lat), lng: Number(l.lng) }])
  );

  const { data: activeUsers } = await supabase
    .from("users")
    .select("id, home_lat, home_lng, office_lat, office_lng")
    .eq("is_active", true);

  const userCoordsMap = new Map(
    (activeUsers ?? []).map((u) => [
      u.id,
      {
        home: u.home_lat != null && u.home_lng != null ? { lat: Number(u.home_lat), lng: Number(u.home_lng) } : null,
        office: u.office_lat != null && u.office_lng != null ? { lat: Number(u.office_lat), lng: Number(u.office_lng) } : null,
      }
    ])
  );

  // Resolve user target location based on locationMode
  let myLoc: { lat: number; lng: number } | null = null;
  if (locationMode === "office") {
    if (user.office_lat != null && user.office_lng != null) {
      myLoc = { lat: Number(user.office_lat), lng: Number(user.office_lng) };
    }
  } else if (locationMode === "current") {
    const cur = locationMap.get(user.id);
    if (cur) {
      myLoc = { lat: cur.lat, lng: cur.lng };
    }
  }
  
  // Default to home if office/current not set or home selected
  if (!myLoc && user.home_lat != null && user.home_lng != null) {
    myLoc = { lat: Number(user.home_lat), lng: Number(user.home_lng) };
  }

  const { data: asked } = await supabase
    .from("questions")
    .select("*, question_targets(status, professional_id)")
    .eq("asker_id", user.id);

  const { data: targeted } = await supabase
    .from("question_targets")
    .select("*, questions(*, question_targets(status, professional_id))")
    .eq("professional_id", user.id);

  const { data: sessions } = await supabase
    .from("chat_sessions")
    .select("id, question_id, created_at, chat_messages(body, created_at, sender_id), chat_participants(user_id, alias)");

  const sessionActivityMap = new Map<string, { time: string; body: string | null; sender_id: string | null; target_alias: string | null; sessionId: string }>();
  let aiSession = null;

  if (sessions) {
    for (const session of sessions) {
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

      let targetAlias = null;
      if (session.chat_participants) {
        const otherP = session.chat_participants.find((p: any) => p.user_id !== user.id);
        if (otherP) targetAlias = otherP.alias;
      }

      if (!session.question_id && targetAlias === "ProxNet AI") {
        aiSession = {
          id: session.id,
          latest_activity_at: latestTime,
          latest_message_body: latestBody,
          latest_message_sender: latestSender,
          target_alias: targetAlias,
        };
        continue;
      }

      if (!session.question_id) continue;
      
      const currentLatest = sessionActivityMap.get(session.question_id);
      if (!currentLatest || new Date(latestTime).getTime() > new Date(currentLatest.time).getTime()) {
        sessionActivityMap.set(session.question_id, {
          time: latestTime,
          body: latestBody,
          sender_id: latestSender,
          target_alias: targetAlias,
          sessionId: session.id
        });
      }
    }
  }

  const askedWithActivity = (asked ?? []).map((q) => {
    const activity = sessionActivityMap.get(q.id);
    let sender = null;
    if (activity?.sender_id) {
      sender = activity.sender_id === user.id ? "asker" : "responder";
    }

    // Resolve other participant distance
    let dist = null;
    const session = sessions?.find(s => s.question_id === q.id);
    const otherParticipant = session?.chat_participants?.find((p: any) => p.user_id !== user.id);
    const otherUserId = otherParticipant?.user_id;
    if (otherUserId && myLoc) {
      const coords = userCoordsMap.get(otherUserId);
      const current = locationMap.get(otherUserId);
      const locs = [];
      if (coords?.home) locs.push(coords.home);
      if (coords?.office) locs.push(coords.office);
      if (current) locs.push(current);

      let minDist = Infinity;
      for (const loc of locs) {
        const d = haversineDistanceMeters(myLoc.lat, myLoc.lng, loc.lat, loc.lng);
        if (d < minDist) minDist = d;
      }
      dist = minDist === Infinity ? null : minDist;
    }

    return { 
      ...q, 
      latest_activity_at: activity?.time || q.created_at,
      latest_message_body: activity?.body || null,
      latest_message_sender: sender,
      target_alias: activity?.target_alias || null,
      session_id: activity?.sessionId || null,
      distance: dist,
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
    let sender = null;
    if (activity?.sender_id) {
      sender = activity.sender_id === user.id ? "responder" : "asker";
    }

    // Resolve asker distance relative to myLoc
    const dist = (q.center_lat != null && q.center_lng != null && myLoc)
      ? haversineDistanceMeters(Number(q.center_lat), Number(q.center_lng), myLoc.lat, myLoc.lng)
      : null;

    return {
      id: q.id,
      body: q.body,
      status: t.status,
      company_filter: q.company_filter,
      title_filter: q.title_filter,
      created_at: q.created_at,
      asker_alias: activity?.target_alias || `Resident-${q.asker_id.slice(0, 4)}`,
      asker_id: q.asker_id,
      target_id: t.id,
      latest_activity_at: activity?.time || q.created_at,
      latest_message_body: activity?.body || null,
      latest_message_sender: sender,
      session_id: activity?.sessionId || null,
      distance: dist,
    };
  });
  incomingWithActivity.sort((a, b) => new Date(b.latest_activity_at).getTime() - new Date(a.latest_activity_at).getTime());

  // Fetch follows for current user
  const { data: userFollows } = await supabase
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", user.id);
  const followedUserIds = (userFollows ?? []).map((f) => f.following_id);

  // Fetch forum questions with poster details
  const { data: allForumQuestions } = await supabase
    .from("questions")
    .select("*, users(anonymous_name, job_title, company), question_comments(id)")
    .eq("type", "forum")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(50);

  const forumWithActivity = (allForumQuestions ?? [])
    .map((q) => {
      const u = q.users as any;
      const dist = (myLoc && q.center_lat != null && q.center_lng != null)
        ? haversineDistanceMeters(Number(q.center_lat), Number(q.center_lng), myLoc.lat, myLoc.lng)
        : null;

      return {
        id: q.id,
        body: q.body,
        anonymous_name: u?.anonymous_name || `Neighbour-${q.asker_id.slice(0, 4)}`,
        poster_title: u?.job_title || "Professional",
        poster_company: u?.company || "Nearby",
        created_at: q.created_at,
        likes_count: q.likes_count || 0,
        comments_count: q.question_comments?.length || 0,
        distance: dist,
      };
    });

  let suggestions: any[] = [];
  if (myLoc && user.job_title) {
    // 1. Try vector similarity match first
    const { data: userRecord } = await supabase.from("users").select("embedding, resume_text, about").eq("id", user.id).single();
    
    let userEmbedding = userRecord?.embedding;
    if (!userEmbedding && userRecord) {
      const OPENAI_KEY = process.env.OPENAI_API_KEY;
      if (OPENAI_KEY) {
        const denseContext = userRecord.resume_text ? `Resume: ${userRecord.resume_text}` : `About: ${userRecord.about || "None"}`;
        const textToEmbed = `Company: ${user.company || "None"}\nRole: ${user.job_title || "None"}\n${denseContext}`.slice(0, 8000);
        try {
          const oaiRes = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${OPENAI_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              input: textToEmbed,
              model: "text-embedding-3-small"
            })
          });
          if (oaiRes.ok) {
            const oaiData = await oaiRes.json();
            if (oaiData.data?.[0]?.embedding) {
              userEmbedding = oaiData.data[0].embedding;
              // Persist to DB
              await supabase.from("users").update({ embedding: userEmbedding }).eq("id", user.id);
            }
          }
        } catch (e) {
          console.error("Failed to generate user embedding on-the-fly for Q&A:", e);
        }
      }
    }

    let vectorMatches: any[] = [];
    if (userEmbedding) {
      const { data: matches, error: rpcError } = await supabase.rpc("match_professionals_rpc", {
        query_embedding: userEmbedding,
        exclude_id: user.id,
        match_count: 100 // larger count to allow 5km filtering
      });
      if (!rpcError && matches && matches.length > 0) {
        vectorMatches = matches;
      }
    }

    if (vectorMatches.length > 0) {
      // Filter candidates strictly within 5km (5000 meters)
      const nearbyMatches = vectorMatches.filter((u: any) => {
        if (!u.home_lat || !u.home_lng) return false;
        const dist = haversineDistanceMeters(myLoc.lat, myLoc.lng, u.home_lat, u.home_lng);
        return dist <= 5000;
      }).slice(0, 5);

      // Fetch AI reasons in parallel
      const OPENAI_KEY = process.env.OPENAI_API_KEY;
      
      suggestions = await Promise.all(nearbyMatches.map(async (u: any) => {
        let reason = "High compatibility based on your professional background.";
        
        if (OPENAI_KEY) {
          try {
            const summaryA = `Company: ${user.company || 'None'}, Role: ${user.job_title || 'None'}, About: ${userRecord?.about || 'None'}, Resume: ${userRecord?.resume_text ? userRecord.resume_text.slice(0, 500) : 'None'}`;
            const summaryB = `Company: ${u.company || 'None'}, Role: ${u.job_title || 'None'}, About: ${u.about || 'None'}, Resume: ${u.resume_text ? u.resume_text.slice(0, 500) : 'None'}`;

            const prompt = `You are an expert AI professional matchmaker. 
User A Summary: ${summaryA}
User B Summary: ${summaryB}

Analyze their backgrounds and write exactly ONE short, conversational sentence explaining why User A should connect with User B. Focus on shared domains, complementary skills, or common goals. Do not use their names, use "You both" or "You and this professional".`;
            
            const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
                max_tokens: 60
              })
            });
            if (oaiRes.ok) {
              const oaiData = await oaiRes.json();
              reason = oaiData.choices[0].message.content.trim();
            }
          } catch (e) {
            console.error("Failed to generate reason", e);
          }
        }

        return {
          user: {
            id: u.id,
            company: u.company,
            job_title: u.job_title,
            full_name: u.full_name,
            profile_photo_url: u.profile_photo_url
          },
          score: Math.round(u.similarity * 100),
          distance: haversineDistanceMeters(myLoc.lat, myLoc.lng, u.home_lat, u.home_lng),
          reason
        };
      }));
    } else {
      // Fallback to legacy string matching if RPC is missing or embedding missing
      const { data: allUsers } = await supabase
        .from("users")
        .select("id, full_name, company, job_title, profile_photo_url, home_lat, home_lng, about")
        .neq("id", user.id)
        .not("home_lat", "is", null);

      if (allUsers) {
        suggestions = allUsers.map((u: any) => {
           const dist = haversineDistanceMeters(myLoc.lat, myLoc.lng, u.home_lat, u.home_lng);
           let score = 0;
           if (u.job_title?.toLowerCase() === user.job_title?.toLowerCase()) score += 60;
           else if (u.job_title && user.job_title && (u.job_title.includes(user.job_title) || user.job_title.includes(u.job_title))) score += 30;
           if (u.company?.toLowerCase() === user.company?.toLowerCase()) score += 40;

           let reason = "Legacy profile match.";
           if (score >= 60) reason = "You share identical job titles.";
           else if (score >= 40) reason = "You work at the same company.";
           else if (score >= 30) reason = "You are in similar roles.";

           return {
              user: {
                id: u.id,
                company: u.company,
                job_title: u.job_title,
                full_name: u.full_name,
                profile_photo_url: u.profile_photo_url
              },
              score,
              distance: dist,
              reason
           };
        }).filter(s => s.score > 0 && s.distance <= 5000).sort((a, b) => b.score - a.score).slice(0, 5);
      }
    }
  }

  return NextResponse.json({
    asked: askedWithActivity,
    incoming: incomingWithActivity,
    forum: forumWithActivity,
    suggestions,
    aiSession,
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
    targetUserId,
    centerLat,
    centerLng,
    radiusMeters,
  } = body;

  let lat = centerLat;
  let lng = centerLng;
  if (lat == null || lng == null) {
    const u = user as any;
    lat = u.home_lat || u.office_lat || 0.0;
    lng = u.home_lng || u.office_lng || 0.0;
  }

  if (!questionBody?.trim()) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }

  let sessionId: string | undefined = undefined;
  let hasLowWallet = false;
  const supabase = createAdminClient();

  if (targetUserId) {
    // Check wallet before proceeding with a new chat
    const { data: userData } = await supabase.from("users").select("wallet").eq("id", user.id).single();
    hasLowWallet = !userData || (userData.wallet ?? 0) < 1;
    // We are no longer blocking if credits are 0, just setting a flag.

    const { data: existingTargets } = await supabase
      .from("question_targets")
      .select("question_id, questions(id, asker_id, type)")
      .eq("professional_id", targetUserId);

    const match = existingTargets?.find(t => {
      const qList = t.questions as any;
      const q = Array.isArray(qList) ? qList[0] : qList;
      return q && q.type === "direct" && q.asker_id === user.id;
    });

    const getExistingSessionResponse = async (q: any) => {
      const { data: session } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("question_id", q.id)
        .maybeSingle();

      if (session) {
        if (questionBody && questionBody.trim()) {
          // Check if last message is identical to avoid duplicate posts on double clicks
          const { data: lastMsg } = await supabase
            .from("chat_messages")
            .select("body")
            .eq("session_id", session.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!lastMsg || lastMsg.body !== questionBody.trim()) {
            await supabase.from("chat_messages").insert({
              session_id: session.id,
              sender_id: user.id,
              body: questionBody.trim(),
            });

            // Send notification
            try {
              const { data: otherP } = await supabase
                .from("chat_participants")
                .select("user_id")
                .eq("session_id", session.id)
                .neq("user_id", user.id)
                .maybeSingle();

              if (otherP) {
                const { data: myP } = await supabase
                  .from("chat_participants")
                  .select("alias")
                  .eq("session_id", session.id)
                  .eq("user_id", user.id)
                  .maybeSingle();

                await sendNotification(otherP.user_id, {
                  title: "New Message",
                  body: `${myP?.alias || "Resident"}: "${questionBody.trim().slice(0, 60)}${questionBody.trim().length > 60 ? "..." : ""}"`,
                  url: `/chat/${session.id}`,
                  data: { sessionId: session.id }
                });

                // Simulated professional response logic
                const { data: otherUser } = await supabase
                  .from("users")
                  .select("source, job_title, company")
                  .eq("id", otherP.user_id)
                  .maybeSingle();

                if (otherUser && otherUser.source === "simulated") {
                  (async () => {
                    try {
                      const apiKey = process.env.ANTHROPIC_API_KEY;
                      if (!apiKey) return;

                      const { data: prevMsgs } = await supabase
                        .from("chat_messages")
                        .select("body, sender_id")
                        .eq("session_id", session.id)
                        .order("created_at", { ascending: true });

                      const history = (prevMsgs || []).map((m: any) => ({
                        role: m.sender_id === user.id ? "user" : "assistant",
                        content: m.body
                      }));

                      const systemPrompt = `You are a professional local resident networking on ProxNet.
Your Profile:
Role: ${otherUser.job_title}
Company: ${otherUser.company}

You are chatting with a local neighbor who connected with you.
Be helpful, professional, and friendly. Speak naturally as a real human professional. Keep your answers extremely short and concise (1-3 sentences maximum).
Never mention that you are an AI assistant or simulated user. Play your character fully.`;

                      const modelName = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
                      const response = await fetch("https://api.anthropic.com/v1/messages", {
                        method: "POST",
                        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
                        body: JSON.stringify({
                          model: modelName,
                          system: systemPrompt,
                          max_tokens: 250,
                          messages: history,
                        }),
                      });

                      if (response.ok) {
                        const result = await response.json();
                        const replyText = result.content?.[0]?.text || "";
                        if (replyText.trim()) {
                          await supabase.from("chat_messages").insert({
                            session_id: session.id,
                            sender_id: otherP.user_id,
                            body: replyText.trim()
                          });
                        }
                      }
                    } catch (e) {
                      console.error("Failed to generate simulated professional AI response:", e);
                    }
                  })();
                }
              }
            } catch (err) {
              console.error("Failed to send notification for matched direct question message:", err);
            }
          }
        }
        return NextResponse.json({ question: q, alreadyExists: true, sessionId: session.id });
      }
      return NextResponse.json({ question: q, alreadyExists: true });
    };

    if (match) {
      const qList = match.questions as any;
      const q = Array.isArray(qList) ? qList[0] : qList;
      return await getExistingSessionResponse(q);
    }

    const { data: existingReverse } = await supabase
      .from("question_targets")
      .select("question_id, questions(id, asker_id, type)")
      .eq("professional_id", user.id);

    const reverseMatch = existingReverse?.find(t => {
      const qList = t.questions as any;
      const q = Array.isArray(qList) ? qList[0] : qList;
      return q && q.type === "direct" && q.asker_id === targetUserId;
    });
    if (reverseMatch) {
      const qList = reverseMatch.questions as any;
      const q = Array.isArray(qList) ? qList[0] : qList;
      return await getExistingSessionResponse(q);
    }
  }

  const isForum = !companyFilter && !titleFilter && !targetUserId;

  const { data: question, error: qError } = await supabase
    .from("questions")
    .insert({
      asker_id: user.id,
      body: questionBody.trim(),
      company_filter: companyFilter || null,
      title_filter: titleFilter || null,
      center_lat: lat,
      center_lng: lng,
      radius_meters: radiusMeters ?? 100,
      type: isForum ? "forum" : "direct",
    })
    .select("*")
    .single();

  if (qError) return NextResponse.json({ error: qError.message }, { status: 500 });

  // Award points to the inviter if this is the invitee's first question
  if (user.invited_by) {
    const { count } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("asker_id", user.id)
      .neq("id", question.id); // exclude current question
    
    if (count === 0) {
      await awardPoints(user.invited_by, "INVITEE_FIRST_POST", question.id).catch((e) =>
        console.error("Failed to award points for invitee first post:", e)
      );
    }
  }

  if (isForum) {
    // Notify nearby users or followers
    (async () => {
      try {
        const { data: activeUsers } = await supabase
          .from("users")
          .select("id, home_lat, home_lng, office_lat, office_lng")
          .eq("is_active", true)
          .neq("id", user.id);

        const { data: followers } = await supabase
          .from("user_follows")
          .select("follower_id")
          .eq("following_id", user.id);
        const followerIds = new Set((followers ?? []).map((f) => f.follower_id));

        if (activeUsers) {
          for (const u of activeUsers) {
            const isFollower = followerIds.has(u.id);
            let isNearby = false;

            if (!isFollower && lat != null && lng != null) {
              const locsToCheck = [];
              if (u.home_lat != null && u.home_lng != null) locsToCheck.push({ lat: Number(u.home_lat), lng: Number(u.home_lng) });
              if (u.office_lat != null && u.office_lng != null) locsToCheck.push({ lat: Number(u.office_lat), lng: Number(u.office_lng) });

              for (const loc of locsToCheck) {
                const distance = haversineDistanceMeters(Number(lat), Number(lng), loc.lat, loc.lng);
                if (distance <= 2000) {
                  isNearby = true;
                  break;
                }
              }
            }

            if (isFollower || isNearby) {
              const posterName = user.anonymous_name || "Neighbour";
              const companyName = user.company || "Nearby";
              await sendNotification(u.id, {
                title: isFollower ? `New post from ${posterName} @ ${companyName}` : "New Post in your Neighborhood",
                body: `"${questionBody.trim().slice(0, 80)}${questionBody.trim().length > 80 ? "..." : ""}"`,
                url: "/?tab=forum",
              });
            }
          }
        }
      } catch (e) {
        console.error("Failed to notify users of new forum post:", e);
      }
    })();
  }

  if (!isForum) {
    let targets: { question_id: string; professional_id: string }[] = [];

    if (targetUserId) {
      targets.push({ question_id: question.id, professional_id: targetUserId });
      
      const { data: session } = await supabase.from("chat_sessions").insert({ question_id: question.id }).select("id").single();
      if (session) {
        sessionId = session.id;
        const { data: usersData } = await supabase.from("users").select("id, company, job_title").in("id", [user.id, targetUserId]);
        const asker = usersData?.find((u) => u.id === user.id);
        const pro = usersData?.find((u) => u.id === targetUserId);

        const getAlias = (u: any, defaultType: "resident" | "professional") => {
          if (u && u.job_title && u.company) return `${u.job_title} @ ${u.company}`;
          return generateAlias(defaultType, 1, u?.company);
        };

        await supabase.from("chat_participants").insert([
          { session_id: session.id, user_id: user.id, alias: getAlias(asker, "resident") },
          { session_id: session.id, user_id: targetUserId, alias: getAlias(pro, "professional") },
        ]);

        // Attempt to charge the initiator 1 credit (fails gracefully if insufficient funds)
        await supabase.rpc("charge_session", {
          p_user_id: user.id,
          p_session_id: session.id,
          amount: 1
        });
      }
    } else {
      const { data: users } = await supabase
        .from("users")
        .select("id, company, job_title, home_lat, home_lng, office_lat, office_lng, active_location")
        .eq("is_active", true)
        .neq("id", user.id);
      const { data: currentLocations } = await supabase.from("user_current_locations").select("*");
      const locationMap = new Map(
        (currentLocations ?? []).map((l) => [l.user_id, { lat: Number(l.lat), lng: Number(l.lng) }])
      );

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
    return NextResponse.json({ question, targetCount: targets.length, sessionId, walletWarning: targetUserId && hasLowWallet });
  }

  return NextResponse.json({ question, targetCount: 0 });
}

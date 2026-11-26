import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";

const MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365];

function getTodayIST(): string {
  // Returns YYYY-MM-DD in Asia/Kolkata
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getDayDifference(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1 + "T00:00:00Z");
  const d2 = new Date(dateStr2 + "T00:00:00Z");
  const diffMs = d2.getTime() - d1.getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: streakRow } = await supabase
    .from("user_streaks")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!streakRow) {
    return NextResponse.json({
      current_streak: 0,
      longest_streak: 0,
      previous_streak: 0,
      last_checkin_date: null,
      has_checked_in_today: false,
    });
  }

  const today = getTodayIST();
  const hasCheckedInToday = streakRow.last_checkin_date === today;

  return NextResponse.json({
    current_streak: streakRow.current_streak,
    longest_streak: streakRow.longest_streak,
    previous_streak: streakRow.previous_streak,
    last_checkin_date: streakRow.last_checkin_date,
    has_checked_in_today: hasCheckedInToday,
  });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const today = getTodayIST();

    // 1. Fetch current streak record
    const { data: existing, error: fetchErr } = await supabase
      .from("user_streaks")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchErr) {
      console.error("[streak/check-in] Error fetching streak:", fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    // 2. If no record exists, initialize Day 1 streak
    if (!existing) {
      const newRecord = {
        user_id: user.id,
        current_streak: 1,
        longest_streak: 1,
        last_checkin_date: today,
        previous_streak: 0,
        updated_at: new Date().toISOString(),
      };

      const { data: inserted, error: insertErr } = await supabase
        .from("user_streaks")
        .insert(newRecord)
        .select()
        .single();

      if (insertErr) {
        console.error("[streak/check-in] Error initializing streak:", insertErr);
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        status: "started",
        current_streak: 1,
        longest_streak: 1,
        previous_streak: 0,
        just_incremented: true,
        just_broke: false,
        is_milestone: false,
        message: "Your Diligence Streak #1 day started! 🔥",
      });
    }

    const lastDate = existing.last_checkin_date;
    const diff = getDayDifference(lastDate, today);

    // Case A: Already checked in today
    if (diff === 0) {
      return NextResponse.json({
        success: true,
        status: "already_checked_in",
        current_streak: existing.current_streak,
        longest_streak: existing.longest_streak,
        previous_streak: existing.previous_streak || 0,
        just_incremented: false,
        just_broke: false,
        is_milestone: false,
        message: `Your Diligence Streak #${existing.current_streak} days active! 🔥`,
      });
    }

    // Case B: Visited yesterday -> Increment streak!
    if (diff === 1) {
      const nextStreak = existing.current_streak + 1;
      const nextLongest = Math.max(existing.longest_streak, nextStreak);
      const isMilestone = MILESTONES.includes(nextStreak);

      const { error: updateErr } = await supabase
        .from("user_streaks")
        .update({
          current_streak: nextStreak,
          longest_streak: nextLongest,
          last_checkin_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateErr) {
        console.error("[streak/check-in] Error incrementing streak:", updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      // If milestone reached, dispatch in-app celebration notification
      if (isMilestone) {
        sendNotification(user.id, {
          title: `🏆 Diligence Milestone Unlocked: #${nextStreak} Days!`,
          body: `Incredible dedication! You have checked ProxNet for #${nextStreak} consecutive days. Keep inspiring your network!`,
          url: "/network",
          data: {
            type: "streak_milestone",
            streak: nextStreak,
          },
        }).catch((err) => console.error("[streak] Milestone notification failed:", err));
      }

      return NextResponse.json({
        success: true,
        status: "continued",
        current_streak: nextStreak,
        longest_streak: nextLongest,
        previous_streak: existing.previous_streak || 0,
        just_incremented: true,
        just_broke: false,
        is_milestone: isMilestone,
        message: `Your Diligence Streak #${nextStreak} days! 🔥`,
      });
    }

    // Case C: diff > 1 -> Streak broken!
    // If diff < 0 (clock skew backwards), do nothing
    if (diff < 0) {
      return NextResponse.json({
        success: true,
        status: "already_checked_in",
        current_streak: existing.current_streak,
        longest_streak: existing.longest_streak,
        previous_streak: existing.previous_streak || 0,
        just_incremented: false,
        just_broke: false,
        is_milestone: false,
      });
    }

    // Streak is broken!
    const brokenStreakCount = existing.current_streak;
    const { error: resetErr } = await supabase
      .from("user_streaks")
      .update({
        previous_streak: brokenStreakCount,
        current_streak: 1,
        last_checkin_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (resetErr) {
      console.error("[streak/check-in] Error resetting broken streak:", resetErr);
      return NextResponse.json({ error: resetErr.message }, { status: 500 });
    }

    // Trigger notification if broken streak was >= 2 days
    if (brokenStreakCount >= 2) {
      sendNotification(user.id, {
        title: "Diligence Streak Reset 💔",
        body: `Your Diligence Streak of #${brokenStreakCount} days broke, Streak count #1 now. Consistency is key — start your new streak today!`,
        url: "/network",
        data: {
          type: "streak_broken",
          streak: 1,
          previous_streak: brokenStreakCount,
        },
      }).catch((err) => console.error("[streak] Broken streak notification failed:", err));
    }

    return NextResponse.json({
      success: true,
      status: "broken",
      current_streak: 1,
      longest_streak: existing.longest_streak,
      previous_streak: brokenStreakCount,
      just_incremented: false,
      just_broke: true,
      is_milestone: false,
      message: `Your Diligence Streak of #${brokenStreakCount} days broke, Streak count #1 now`,
    });
  } catch (err: any) {
    console.error("[streak/check-in] Unexpected error:", err);
    return NextResponse.json({ error: err.message || "Failed to check in streak" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

// GET: Fetch user's application pipeline with counts per stage
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  const { data: applications, error } = await supabase
    .from("job_applications")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return NextResponse.json({
        applications: [],
        stageCounts: {},
        total: 0,
        tableMissing: true,
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Normalize applications: map saved records that contain preparation to stage "prepared"
  const normalizedApplications = (applications || []).map((app: any) => {
    let stage = app.stage;
    if (stage === "saved" && app.notes) {
      try {
        const parsed = JSON.parse(app.notes);
        if (parsed.strengths || parsed.isPrepared || parsed.stage === "prepared") {
          stage = "prepared";
        }
      } catch {}
    }
    return {
      ...app,
      stage,
    };
  });

  // Compute stage counts
  const stageCounts: Record<string, number> = {};
  for (const app of normalizedApplications) {
    stageCounts[app.stage] = (stageCounts[app.stage] || 0) + 1;
  }

  return NextResponse.json({
    applications: normalizedApplications,
    stageCounts,
    total: normalizedApplications.length,
  });
}

// POST: Save a job to the pipeline (or update stage)
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId, company, jobTitle, jobUrl, stage, matchScore, notes, referralThreadId } = await request.json();
  if (!company || !jobTitle) {
    return NextResponse.json({ error: "Missing company or jobTitle" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const isUuid = (str: any) => typeof str === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  const validJobUuid = isUuid(jobId) ? jobId : null;

  // Check for existing application by job_id or company + jobTitle
  let existing: { id: string; stage: string } | null = null;
  if (validJobUuid) {
    const { data } = await supabase
      .from("job_applications")
      .select("id, stage")
      .eq("user_id", user.id)
      .eq("job_id", validJobUuid)
      .maybeSingle();
    if (data) existing = data;
  }
  if (!existing && company && jobTitle) {
    const { data } = await supabase
      .from("job_applications")
      .select("id, stage")
      .eq("user_id", user.id)
      .ilike("company", company.trim())
      .ilike("job_title", jobTitle.trim())
      .maybeSingle();
    if (data) existing = data;
  }

  const targetStage = stage || "saved";

  if (existing) {
    let { data: updated, error: updateErr } = await supabase
      .from("job_applications")
      .update({
        company: company.trim(),
        job_title: jobTitle.trim(),
        job_url: jobUrl || null,
        stage: targetStage,
        match_score: matchScore !== undefined ? matchScore : null,
        notes: notes !== undefined ? notes : null,
        referral_thread_id: referralThreadId || null,
        applied_at: targetStage === "applied" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateErr && (updateErr.code === "23514" || updateErr.message?.includes("stage_check"))) {
      // Fallback to 'saved' stage if DB constraint restricts 'prepared'
      const { data: fallbackUpdated, error: fallbackErr } = await supabase
        .from("job_applications")
        .update({
          company: company.trim(),
          job_title: jobTitle.trim(),
          job_url: jobUrl || null,
          stage: "saved",
          match_score: matchScore !== undefined ? matchScore : null,
          notes: notes !== undefined ? notes : null,
          referral_thread_id: referralThreadId || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (fallbackErr) return NextResponse.json({ error: fallbackErr.message }, { status: 500 });
      updated = fallbackUpdated;
    } else if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      application: { ...updated, stage: targetStage },
      alreadySaved: true,
    });
  }

  let { data: inserted, error: insertErr } = await supabase
    .from("job_applications")
    .insert({
      user_id: user.id,
      job_id: validJobUuid,
      company: company.trim(),
      job_title: jobTitle.trim(),
      job_url: jobUrl || null,
      stage: targetStage,
      match_score: matchScore || null,
      notes: notes || null,
      referral_thread_id: referralThreadId || null,
      applied_at: targetStage === "applied" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertErr && (insertErr.code === "23514" || insertErr.message?.includes("stage_check"))) {
    // Fallback to 'saved' stage if DB constraint restricts 'prepared'
    const { data: fallbackInserted, error: fallbackErr } = await supabase
      .from("job_applications")
      .insert({
        user_id: user.id,
        job_id: validJobUuid,
        company: company.trim(),
        job_title: jobTitle.trim(),
        job_url: jobUrl || null,
        stage: "saved",
        match_score: matchScore || null,
        notes: notes || null,
        referral_thread_id: referralThreadId || null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (fallbackErr) {
      return NextResponse.json({ error: fallbackErr.message }, { status: 500 });
    }
    inserted = fallbackInserted;
  } else if (insertErr) {
    if (insertErr.code === "42P01" || insertErr.message?.includes("does not exist")) {
      return NextResponse.json(
        { error: "Application tracking table not yet provisioned.", tableMissing: true },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    application: { ...inserted, stage: targetStage },
    created: true,
  });
}

// PATCH: Update an application's stage or notes
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { applicationId, stage, notes } = await request.json();
  if (!applicationId) {
    return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (stage) updates.stage = stage;
  if (notes !== undefined) updates.notes = notes;
  if (stage === "applied") updates.applied_at = new Date().toISOString();

  let { data, error } = await supabase
    .from("job_applications")
    .update(updates)
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error && (error.code === "23514" || error.message?.includes("stage_check")) && stage === "prepared") {
    // Fallback to 'saved' stage
    updates.stage = "saved";
    const { data: fallbackData, error: fallbackErr } = await supabase
      .from("job_applications")
      .update(updates)
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .select()
      .single();
    if (fallbackErr) return NextResponse.json({ error: fallbackErr.message }, { status: 500 });
    data = fallbackData;
  } else if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, application: { ...data, stage: stage || data?.stage } });
}

// DELETE: Remove a saved job
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const applicationId = searchParams.get("id");
  if (!applicationId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("job_applications")
    .delete()
    .eq("id", applicationId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

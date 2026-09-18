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

  // Compute stage counts
  const stageCounts: Record<string, number> = {};
  for (const app of applications || []) {
    stageCounts[app.stage] = (stageCounts[app.stage] || 0) + 1;
  }

  return NextResponse.json({
    applications: applications || [],
    stageCounts,
    total: applications?.length || 0,
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

  // Check for existing application by job_id or company + jobTitle
  let existing: { id: string; stage: string } | null = null;
  if (jobId) {
    const { data } = await supabase
      .from("job_applications")
      .select("id, stage")
      .eq("user_id", user.id)
      .eq("job_id", jobId)
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

  if (existing) {
    const { data: updated, error: updateErr } = await supabase
      .from("job_applications")
      .update({
        company: company.trim(),
        job_title: jobTitle.trim(),
        job_url: jobUrl || null,
        stage: stage || existing.stage || "saved",
        match_score: matchScore !== undefined ? matchScore : null,
        notes: notes !== undefined ? notes : null,
        referral_thread_id: referralThreadId || null,
        applied_at: stage === "applied" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, application: updated, alreadySaved: true });
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("job_applications")
    .insert({
      user_id: user.id,
      job_id: jobId || null,
      company: company.trim(),
      job_title: jobTitle.trim(),
      job_url: jobUrl || null,
      stage: stage || "saved",
      match_score: matchScore || null,
      notes: notes || null,
      referral_thread_id: referralThreadId || null,
      applied_at: stage === "applied" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertErr) {
    if (insertErr.code === "42P01" || insertErr.message?.includes("does not exist")) {
      return NextResponse.json(
        { error: "Application tracking table not yet provisioned. Run migration 20260917_job_application_tracker.sql.", tableMissing: true },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, application: inserted, created: true });
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

  const { data, error } = await supabase
    .from("job_applications")
    .update(updates)
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, application: data });
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

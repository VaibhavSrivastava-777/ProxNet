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

  // Normalize applications:
  // Pipeline stages: applied | interview | pipe | offer | rejected
  // Independent prepared status: is_prepared (true if playbook/strengths exist in notes)
  const normalizedApplications = (applications || []).map((app: any) => {
    let stage = app.stage;
    if (stage === "saved" || stage === "prepared" || stage === "referral_sent" || stage === "referral_responded") {
      stage = "pipe";
    }

    const is_prepared = Boolean(
      app.notes &&
      (app.notes.includes('"strengths"') ||
       app.notes.includes('strengths') ||
       app.notes.includes('"isPrepared":true'))
    );

    return {
      ...app,
      stage,
      is_prepared,
    };
  });

  // Compute stage counts + independent prepared count
  const stageCounts: Record<string, number> = {
    applied: 0,
    interview: 0,
    pipe: 0,
    offer: 0,
    rejected: 0,
    prepared: 0,
  };

  for (const app of normalizedApplications) {
    if (stageCounts[app.stage] !== undefined) {
      stageCounts[app.stage]++;
    } else {
      stageCounts[app.stage] = 1;
    }
    if (app.is_prepared) {
      stageCounts.prepared++;
    }
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
  let existing: any = null;
  if (validJobUuid) {
    const { data } = await supabase
      .from("job_applications")
      .select("*")
      .eq("user_id", user.id)
      .eq("job_id", validJobUuid)
      .maybeSingle();
    if (data) existing = data;
  }
  if (!existing && company && jobTitle) {
    const { data } = await supabase
      .from("job_applications")
      .select("*")
      .eq("user_id", user.id)
      .ilike("company", company.trim())
      .ilike("job_title", jobTitle.trim())
      .maybeSingle();
    if (data) existing = data;
  }

  // Client stage: 'applied' | 'interview' | 'pipe' | 'offer' | 'rejected'
  const clientStage = stage || (existing ? existing.stage : "pipe");
  // Map 'pipe' to 'saved' for DB check constraint compatibility
  const dbStage = clientStage === "pipe" ? "saved" : clientStage;

  // Notes preservation: Ensure existing playbook strengths/details are NEVER wiped out
  let finalNotes = notes;
  if (existing?.notes) {
    try {
      const existingParsed = JSON.parse(existing.notes);
      if (existingParsed.strengths) {
        let incomingParsed: any = {};
        if (notes) {
          try { incomingParsed = typeof notes === "string" ? JSON.parse(notes) : notes; } catch {}
        }
        finalNotes = JSON.stringify({
          ...existingParsed,
          ...incomingParsed,
          strengths: existingParsed.strengths,
          weaknesses: existingParsed.weaknesses || incomingParsed.weaknesses,
          roleExpectations: existingParsed.roleExpectations || incomingParsed.roleExpectations,
          networkingPath: existingParsed.networkingPath || incomingParsed.networkingPath,
          customPitch: existingParsed.customPitch || incomingParsed.customPitch,
          isPrepared: true,
        });
      }
    } catch {}
  }

  if (existing) {
    const { data: updated, error: updateErr } = await supabase
      .from("job_applications")
      .update({
        company: company.trim(),
        job_title: jobTitle.trim(),
        job_url: jobUrl || existing.job_url || null,
        stage: dbStage,
        match_score: matchScore !== undefined ? matchScore : existing.match_score,
        notes: finalNotes !== undefined ? finalNotes : existing.notes,
        referral_thread_id: referralThreadId || existing.referral_thread_id,
        applied_at: clientStage === "applied" ? (existing.applied_at || new Date().toISOString()) : existing.applied_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const is_prepared = Boolean(
      updated?.notes &&
      (updated.notes.includes('"strengths"') || updated.notes.includes('strengths'))
    );

    return NextResponse.json({
      success: true,
      application: { ...updated, stage: clientStage, is_prepared },
      alreadySaved: true,
    });
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("job_applications")
    .insert({
      user_id: user.id,
      job_id: validJobUuid,
      company: company.trim(),
      job_title: jobTitle.trim(),
      job_url: jobUrl || null,
      stage: dbStage,
      match_score: matchScore || null,
      notes: finalNotes || null,
      referral_thread_id: referralThreadId || null,
      applied_at: clientStage === "applied" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertErr) {
    if (insertErr.code === "42P01" || insertErr.message?.includes("does not exist")) {
      return NextResponse.json(
        { error: "Application tracking table not yet provisioned.", tableMissing: true },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  const is_prepared = Boolean(
    inserted?.notes &&
    (inserted.notes.includes('"strengths"') || inserted.notes.includes('strengths'))
  );

  return NextResponse.json({
    success: true,
    application: { ...inserted, stage: clientStage, is_prepared },
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

  // Fetch existing application first to preserve playbook notes
  const { data: existing } = await supabase
    .from("job_applications")
    .select("*")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  
  let clientStage = stage;
  if (stage) {
    // Map 'pipe' to 'saved' for DB constraint
    const dbStage = stage === "pipe" ? "saved" : stage;
    updates.stage = dbStage;
    if (stage === "applied" && !existing?.applied_at) {
      updates.applied_at = new Date().toISOString();
    }
  }

  if (notes !== undefined) {
    let finalNotes = notes;
    if (existing?.notes) {
      try {
        const existingParsed = JSON.parse(existing.notes);
        if (existingParsed.strengths) {
          let incomingParsed: any = {};
          if (notes) {
            try { incomingParsed = typeof notes === "string" ? JSON.parse(notes) : notes; } catch {}
          }
          finalNotes = JSON.stringify({
            ...existingParsed,
            ...incomingParsed,
            strengths: existingParsed.strengths,
            weaknesses: existingParsed.weaknesses || incomingParsed.weaknesses,
            roleExpectations: existingParsed.roleExpectations || incomingParsed.roleExpectations,
            networkingPath: existingParsed.networkingPath || incomingParsed.networkingPath,
            customPitch: existingParsed.customPitch || incomingParsed.customPitch,
            isPrepared: true,
          });
        }
      } catch {}
    }
    updates.notes = finalNotes;
  }

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

  let returnedStage = stage || data?.stage;
  if (returnedStage === "saved" || returnedStage === "prepared") {
    returnedStage = "pipe";
  }

  const is_prepared = Boolean(
    data?.notes &&
    (data.notes.includes('"strengths"') || data.notes.includes('strengths'))
  );

  return NextResponse.json({
    success: true,
    application: { ...data, stage: returnedStage, is_prepared },
  });
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

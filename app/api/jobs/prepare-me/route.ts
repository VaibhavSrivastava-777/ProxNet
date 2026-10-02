import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { deductWalletCredits } from "@/lib/wallet";
import { haversineDistanceMeters } from "@/lib/geo/haversine";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId, company, title, description, url, location, matchScore } = await request.json();
    if (!company || !title) {
      return NextResponse.json({ error: "Missing company or title" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Fetch user's profile and wallet
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, full_name, email, job_title, company, about, resume_text, wallet, profile_digest, home_lat, home_lng")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const currentWallet = userData.wallet ?? 0;

    const isUuid = (str: any) => typeof str === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const validJobUuid = isUuid(jobId) ? jobId : null;

    // Check if this job was already prepared for this user in job_applications
    let existingApp: any = null;
    if (validJobUuid) {
      const { data } = await supabase
        .from("job_applications")
        .select("*")
        .eq("user_id", user.id)
        .eq("job_id", validJobUuid)
        .maybeSingle();
      if (data) existingApp = data;
    }
    if (!existingApp && company && title) {
      const { data } = await supabase
        .from("job_applications")
        .select("*")
        .eq("user_id", user.id)
        .ilike("company", company.trim())
        .ilike("job_title", title.trim())
        .maybeSingle();
      if (data) existingApp = data;
    }

    if (existingApp?.notes) {
      try {
        const parsedNotes = JSON.parse(existingApp.notes);
        if (parsedNotes.strengths && parsedNotes.roleExpectations) {
          // Already prepared! Return cached version without charging again
          return NextResponse.json({
            success: true,
            preparation: parsedNotes,
            alreadyPrepared: true,
            newWalletBalance: currentWallet,
          });
        }
      } catch {
        // notes wasn't json, continue to generate fresh
      }
    }

    if (currentWallet < 1) {
      return NextResponse.json({
        error: "INSUFFICIENT_CREDITS",
        message: "You need 1 credit to generate a customized 'Prepare Me' playbook. You can recharge or complete profile steps to earn credits.",
        wallet: currentWallet,
      }, { status: 402 });
    }

    // 2. Discover Networking Path: Check for ProxNet insiders at this company
    const compClean = company.trim().toLowerCase();
    const { data: companyUsers } = await supabase
      .from("users")
      .select("id, full_name, anonymous_name, job_title, company, profile_photo_url, home_lat, home_lng")
      .eq("is_blocked", false)
      .neq("id", user.id)
      .ilike("company", `%${company.trim()}%`)
      .limit(5);

    interface ProxNetInsider {
      id: string;
      name: string;
      jobTitle: string;
      company: string;
      distanceKm: number | null;
      photoUrl: string | null;
    }

    const proxnetInsiders: ProxNetInsider[] = [];
    if (companyUsers && companyUsers.length > 0) {
      for (const u of companyUsers) {
        let distKm: number | null = null;
        if (userData.home_lat && userData.home_lng && u.home_lat && u.home_lng) {
          const meters = haversineDistanceMeters(
            Number(userData.home_lat),
            Number(userData.home_lng),
            Number(u.home_lat),
            Number(u.home_lng)
          );
          distKm = Math.round((meters / 1000) * 10) / 10;
        }
        proxnetInsiders.push({
          id: u.id,
          name: u.full_name || u.anonymous_name || "Verified Professional",
          jobTitle: u.job_title || "Colleague",
          company: u.company || company,
          distanceKm: distKm,
          photoUrl: u.profile_photo_url || null,
        });
      }
      proxnetInsiders.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    }

    // Build LinkedIn search URL and targeted outreach message
    const linkedinSearchKeywords = encodeURIComponent(`${company.trim()} "recruiter" OR "talent acquisition" OR "hiring manager"`);
    const linkedinSearchUrl = `https://www.linkedin.com/search/results/people/?keywords=${linkedinSearchKeywords}`;

    const candidateRole = userData.job_title || "Experienced Professional";
    const candidateName = userData.full_name || "a fellow tech professional";
    const candidateSummary = userData.about || userData.resume_text?.substring(0, 300) || "";

    const candidateContext = `Candidate Role: ${candidateRole}
Candidate Company: ${userData.company || "Not specified"}
Candidate Background: ${candidateSummary.slice(0, 1500)}`;

    const OPENAI_KEY = process.env.OPENAI_API_KEY;

    let strengths: string[] = [];
    let weaknesses: string[] = [];
    let roleExpectations: string[] = [];
    let customPitch: string = "";

    if (OPENAI_KEY) {
      try {
        const prompt = `You are an elite executive career strategist and technical recruiter.
Analyze this job opportunity for the candidate and create an incisive, actionable 4-part preparation playbook.

--- JOB DETAILS ---
Company: ${company}
Job Title: ${title}
Location: ${location || "Remote / India"}
Description:
${(description || "").substring(0, 3000)}

--- CANDIDATE DETAILS ---
${candidateContext}

Provide a JSON object with:
{
  "strengths": [
    "3-4 concrete bullet points highlighting candidate's top skill anchors & domain overlap with this exact job"
  ],
  "weaknesses": [
    "2-3 potential skill gaps, unaddressed keywords or interview objections, WITH specific tactics on how candidate should proactively handle them"
  ],
  "roleExpectations": [
    "3-4 key deliverables, organizational KPIs, and what the hiring manager will evaluate in candidate's first 90 days"
  ],
  "customPitch": "A 3-sentence, high-converting warm networking message the candidate can send to an insider or recruiter at ${company}"
}`;

        const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          }),
        });

        if (oaiRes.ok) {
          const oaiData = await oaiRes.json();
          const parsed = JSON.parse(oaiData.choices[0].message.content);
          strengths = Array.isArray(parsed.strengths) ? parsed.strengths : [];
          weaknesses = Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [];
          roleExpectations = Array.isArray(parsed.roleExpectations) ? parsed.roleExpectations : [];
          customPitch = parsed.customPitch || "";
        }
      } catch (err) {
        console.error("OpenAI preparation playbook generation error:", err);
      }
    }

    // Robust Fallbacks if AI service was unavailable
    if (strengths.length === 0) {
      strengths = [
        `Strong foundational alignment between your profile as ${candidateRole} and the ${title} responsibilities.`,
        `Demonstrated tenure and industry problem-solving capability relevant to ${company}'s domain.`,
        `Direct cross-functional execution experience applicable to core requirements in this opening.`,
      ];
    }
    if (weaknesses.length === 0) {
      weaknesses = [
        `Explicit mentions of niche internal tools or specialized platforms specified in the ${title} description: anchor on your fast adaptability and related architectural experience.`,
        `Emphasize scale and measurable impact: prepare specific metrics showing team velocity, customer scale, or efficiency gains in your previous roles.`,
      ];
    }
    if (roleExpectations.length === 0) {
      roleExpectations = [
        `Drive key deliverables within ${company}'s product or operational roadmap while aligning with cross-functional stakeholders.`,
        `Demonstrate autonomy in diagnosing domain bottlenecks, elevating code/process quality, and executing against sprint targets.`,
        `Establish clear communication rhythms and collaborative trust with engineering, product, and leadership partners in the first 90 days.`,
      ];
    }
    if (!customPitch) {
      customPitch = `Hi there! I noticed your work at ${company} and saw the open ${title} position. With my background as a ${candidateRole}, I've led similar initiatives and would love to ask for your perspective or a brief warm intro if you feel it's a mutual fit. Thanks so much!`;
    }

    const preparation = {
      jobId: jobId || "job_" + Date.now(),
      company,
      title,
      location: location || "Remote / India",
      url: url || "",
      matchScore: matchScore || 85,
      strengths,
      weaknesses,
      roleExpectations,
      networkingPath: {
        proxnetInsiders,
        hasProxnetInsiders: proxnetInsiders.length > 0,
        linkedinSearchUrl,
        customPitch,
      },
      preparedAt: new Date().toISOString(),
    };

    // 3. Deduct 1 credit from wallet
    const deduction = await deductWalletCredits(user.id, "prepare_me", jobId || `job_${Date.now()}`, 1);

    // 4. Persist to job_applications under stage: "prepared"
    const payloadNotes = JSON.stringify({
      ...preparation,
      stage: "prepared",
      isPrepared: true,
    });

    if (existingApp?.id) {
      const targetStage = existingApp.stage === "applied" ? "applied" : "prepared";
      const { error: updateErr } = await supabase
        .from("job_applications")
        .update({
          stage: targetStage,
          match_score: matchScore || existingApp.match_score || 85,
          notes: payloadNotes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingApp.id);

      if (updateErr && (updateErr.code === "23514" || updateErr.message?.includes("stage_check"))) {
        // Fallback to 'saved' stage if DB check constraint excludes 'prepared'
        await supabase
          .from("job_applications")
          .update({
            stage: existingApp.stage === "applied" ? "applied" : "saved",
            match_score: matchScore || existingApp.match_score || 85,
            notes: payloadNotes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingApp.id);
      }
    } else {
      const { error: insertErr } = await supabase
        .from("job_applications")
        .insert({
          user_id: user.id,
          job_id: validJobUuid,
          company: company.trim(),
          job_title: title.trim(),
          job_url: url || null,
          stage: "prepared",
          match_score: matchScore || 85,
          notes: payloadNotes,
          applied_at: null,
        });

      if (insertErr && (insertErr.code === "23514" || insertErr.message?.includes("stage_check"))) {
        // Fallback to 'saved' stage if DB check constraint excludes 'prepared'
        const { error: fallbackErr } = await supabase
          .from("job_applications")
          .insert({
            user_id: user.id,
            job_id: validJobUuid,
            company: company.trim(),
            job_title: title.trim(),
            job_url: url || null,
            stage: "saved",
            match_score: matchScore || 85,
            notes: payloadNotes,
            applied_at: null,
          });
        if (fallbackErr) {
          console.error("Fallback insert failed:", fallbackErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      preparation,
      alreadyPrepared: false,
      newWalletBalance: deduction.newBalance,
    });

  } catch (error: any) {
    console.error("[prepare-me API error]:", error);
    return NextResponse.json({
      error: "PREPARATION_FAILED",
      message: error?.message || "Failed to generate preparation playbook.",
    }, { status: 500 });
  }
}

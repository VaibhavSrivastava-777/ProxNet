import { SupabaseClient } from "@supabase/supabase-js";
import { discoverAts } from "@/lib/ats-discovery";
import { STRATEGIES } from "@/lib/scrape-strategies";
import { normalizeCompanyName } from "./discover-competitors";

export interface AtsValidationResult {
  competitorName: string;
  parentCompany?: string;
  provider: string;
  boardTokenOrUrl: string;
  isValid: boolean;
  sampleJobCount: number;
  notes: string;
}

/**
 * Validates ATS for a single competitor and updates company_ats_config in database
 */
export async function validateAndSaveCompetitorAts(
  supabase: SupabaseClient,
  competitorName: string,
  parentCompany?: string
): Promise<AtsValidationResult> {
  const normName = competitorName.trim();
  const normKey = normalizeCompanyName(normName);

  // 1. Check if already configured in company_ats_config
  const { data: existingConfig } = await supabase
    .from("company_ats_config")
    .select("*")
    .ilike("company_name", normName)
    .maybeSingle();

  if (existingConfig && existingConfig.provider && existingConfig.provider !== "none") {
    // Already configured; enrich notes with competitor relationship if parentCompany is supplied
    if (parentCompany) {
      const currentNotes = existingConfig.scrape_notes || "";
      if (!currentNotes.includes(parentCompany)) {
        const updatedNotes = currentNotes
          ? `${currentNotes} | Competitor of: ${parentCompany}`
          : `Competitor of: ${parentCompany}`;
        await supabase
          .from("company_ats_config")
          .update({ scrape_notes: updatedNotes })
          .eq("id", existingConfig.id);
      }

      try {
        await supabase.from("company_competitors").upsert(
          {
            company_name: parentCompany,
            competitor_name: normName,
            discovery_source: "automated",
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_name,competitor_name" }
        );
      } catch {}
    }

    return {
      competitorName: existingConfig.company_name || normName,
      parentCompany,
      provider: existingConfig.provider,
      boardTokenOrUrl: existingConfig.board_token_or_url || "",
      isValid: true,
      sampleJobCount: existingConfig.total_jobs_found || 0,
      notes: existingConfig.scrape_notes || "Existing configuration active",
    };
  }

  // 2. Discover ATS provider and board token
  console.log(`[Competitor ATS] Probing ATS for "${normName}"...`);
  const discovered = await discoverAts(normName);

  let provider = discovered?.provider || "none";
  let boardTokenOrUrl = discovered?.board || "";
  let isValid = false;
  let sampleJobCount = 0;
  let notes = "";

  if (discovered && discovered.provider && discovered.provider !== "none") {
    provider = discovered.provider;
    boardTokenOrUrl = discovered.board;

    // Test scrape strategy if available
    const strategy = STRATEGIES[provider];
    if (strategy) {
      try {
        const jobs = await strategy(boardTokenOrUrl, normName);
        sampleJobCount = jobs?.length || 0;
        isValid = sampleJobCount > 0;
        notes = isValid
          ? `Validated ${provider} board (${sampleJobCount} sample jobs found)`
          : `Discovered ${provider} board but 0 jobs returned`;
      } catch (err: any) {
        notes = `Strategy error: ${err.message}`;
        isValid = false;
      }
    } else {
      isValid = true;
      notes = `Discovered ${provider} endpoint (custom/external)`;
    }
  } else {
    provider = "none";
    notes = "No public ATS board found via automated probes";
    isValid = false;
  }

  // 3. Persist into company_ats_config
  const scrapeMetadata = {
    is_competitor: true,
    competitor_of: parentCompany ? [parentCompany] : [],
    validated_at: new Date().toISOString(),
    status: isValid ? "valid" : "unverified",
    notes,
  };

  try {
    if (existingConfig) {
      await supabase
        .from("company_ats_config")
        .update({
          provider,
          board_token_or_url: boardTokenOrUrl,
          scrape_notes: JSON.stringify(scrapeMetadata),
          total_jobs_found: sampleJobCount,
        })
        .eq("id", existingConfig.id);
    } else {
      await supabase.from("company_ats_config").insert({
        company_name: normName,
        provider,
        board_token_or_url: boardTokenOrUrl,
        scrape_notes: JSON.stringify(scrapeMetadata),
        total_jobs_found: sampleJobCount,
      });
    }
  } catch (dbErr: any) {
    console.warn(`[Competitor ATS] Error saving to company_ats_config for ${normName}:`, dbErr.message);
  }

  // 4. Also mirror into company_competitors table if available
  if (parentCompany) {
    try {
      await supabase.from("company_competitors").upsert(
        {
          company_name: parentCompany,
          competitor_name: normName,
          discovery_source: "automated",
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_name,competitor_name" }
      );
    } catch {
      // Best-effort if table migration is pending
    }
  }

  return {
    competitorName: normName,
    parentCompany,
    provider,
    boardTokenOrUrl,
    isValid,
    sampleJobCount,
    notes,
  };
}

/**
 * Validate a batch of competitors in parallel with concurrency limit
 */
export async function batchValidateCompetitors(
  supabase: SupabaseClient,
  items: Array<{ competitorName: string; parentCompany?: string }>,
  concurrency = 4
): Promise<AtsValidationResult[]> {
  const results: AtsValidationResult[] = [];
  const queue = [...items];

  const worker = async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      try {
        const res = await validateAndSaveCompetitorAts(supabase, item.competitorName, item.parentCompany);
        results.push(res);
      } catch (err: any) {
        results.push({
          competitorName: item.competitorName,
          parentCompany: item.parentCompany,
          provider: "error",
          boardTokenOrUrl: "",
          isValid: false,
          sampleJobCount: 0,
          notes: `Batch error: ${err.message}`,
        });
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

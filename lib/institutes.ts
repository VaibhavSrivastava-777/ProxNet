import { createAdminClient } from "./supabase/admin";
import { isSupabaseConfigured } from "./supabase/is-configured";
import type { Institute, UserInstituteAffiliation } from "./types";

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "yahoo.co.in",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "zoho.com",
]);

/**
 * Fetch all available institutes sorted by name
 */
export async function getInstitutes(): Promise<Institute[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("institutes")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching institutes:", error);
    return [];
  }
  return (data as Institute[]) || [];
}

/**
 * Find institute by email domain
 */
export async function getInstituteByDomain(domain: string): Promise<Institute | null> {
  if (!isSupabaseConfigured() || !domain) return null;
  const cleanDomain = domain.trim().toLowerCase();
  if (PUBLIC_EMAIL_DOMAINS.has(cleanDomain)) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("institutes")
    .select("*")
    .contains("verified_domains", [cleanDomain])
    .maybeSingle();

  if (error) {
    console.error("Error fetching institute by domain:", error);
    return null;
  }
  return data as Institute | null;
}

/**
 * Get all institute affiliations for a specific user, with joined institute details
 */
export async function getUserAffiliations(userId: string): Promise<UserInstituteAffiliation[]> {
  if (!isSupabaseConfigured() || !userId) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_institute_affiliations")
    .select("*, institute:institutes(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching user affiliations:", error);
    return [];
  }
  return (data as UserInstituteAffiliation[]) || [];
}

/**
 * Add or update an institute affiliation for a user
 */
export async function addAffiliation(params: {
  userId: string;
  instituteId: string;
  degree?: string | null;
  batchYear?: number | null;
  userEmail?: string | null;
}): Promise<UserInstituteAffiliation | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createAdminClient();

  // Check if institute exists and check domain verification
  const { data: institute, error: instError } = await supabase
    .from("institutes")
    .select("*")
    .eq("id", params.instituteId)
    .maybeSingle();

  if (instError || !institute) {
    throw new Error("Institute not found");
  }

  let verificationStatus: "verified_domain" | "unverified" = "unverified";
  let verifiedAt: string | null = null;

  if (params.userEmail) {
    const domain = params.userEmail.split("@")[1]?.trim().toLowerCase();
    if (domain && Array.isArray(institute.verified_domains) && institute.verified_domains.includes(domain)) {
      verificationStatus = "verified_domain";
      verifiedAt = new Date().toISOString();
    }
  }

  const cleanDegree = params.degree?.trim() || "Alumnus";
  const batchYear = params.batchYear ? Number(params.batchYear) : null;

  const payload = {
    user_id: params.userId,
    institute_id: params.instituteId,
    degree: cleanDegree,
    batch_year: batchYear,
    verification_status: verificationStatus,
    verified_at: verifiedAt,
  };

  const { data, error } = await supabase
    .from("user_institute_affiliations")
    .upsert(payload, { onConflict: "user_id,institute_id,degree" })
    .select("*, institute:institutes(*)")
    .single();

  if (error) {
    console.error("Error adding affiliation:", error);
    throw error;
  }
  return data as UserInstituteAffiliation;
}

/**
 * Delete an institute affiliation for a user
 */
export async function deleteAffiliation(userId: string, affiliationId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user_institute_affiliations")
    .delete()
    .eq("id", affiliationId)
    .eq("user_id", userId);

  if (error) {
    console.error("Error deleting affiliation:", error);
    return false;
  }
  return true;
}

/**
 * Automatically verify and create affiliation if user's email domain matches any institute
 */
export async function autoVerifyByEmail(userId: string, email: string | null | undefined): Promise<UserInstituteAffiliation | null> {
  if (!email || !userId) return null;
  const domain = email.split("@")[1]?.trim().toLowerCase();
  if (!domain || PUBLIC_EMAIL_DOMAINS.has(domain)) return null;

  const institute = await getInstituteByDomain(domain);
  if (!institute) return null;

  const supabase = createAdminClient();

  // Check if affiliation already exists
  const { data: existing } = await supabase
    .from("user_institute_affiliations")
    .select("id, verification_status")
    .eq("user_id", userId)
    .eq("institute_id", institute.id)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing) {
    if (existing.verification_status !== "verified_domain") {
      const { data: updated } = await supabase
        .from("user_institute_affiliations")
        .update({
          verification_status: "verified_domain",
          verified_at: now,
        })
        .eq("id", existing.id)
        .select("*, institute:institutes(*)")
        .single();
      return updated as UserInstituteAffiliation;
    }
    return null;
  }

  // Insert verified affiliation
  const { data, error } = await supabase
    .from("user_institute_affiliations")
    .insert({
      user_id: userId,
      institute_id: institute.id,
      degree: "Alumnus / Member",
      verification_status: "verified_domain",
      verified_at: now,
    })
    .select("*, institute:institutes(*)")
    .single();

  if (error) {
    console.error("Error auto-verifying affiliation by email:", error);
    return null;
  }
  return data as UserInstituteAffiliation;
}

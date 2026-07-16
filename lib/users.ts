import { createAdminClient } from "./supabase/admin";
import { normalizeLinkedInUrl } from "./linkedin/normalize-url";
import { isSupabaseConfigured } from "./supabase/is-configured";
import { awardPoints } from "./award-points";
import type { User, UserVisibility } from "./types";

/**
 * Generate a unique 8-character invite code prefixed with "PX-".
 * Format: PX-XXXXXX (6 alphanumeric chars = 2.1B combinations).
 */
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `PX-${code}`;
}

const defaultVisibility: UserVisibility = {
  showCompany: true,
  showTitle: true,
  showPhoto: false,
};

export async function findUserByLinkedInSub(sub: string) {
  if (!isSupabaseConfigured()) {
    if (sub === "admin-system") return ensureAdminUser();
    if (sub === "test-user-system") return ensureNonAdminUser();
    return null;
  }
  const supabase = createAdminClient();
  const { data } = await supabase.from("users").select("*").eq("linkedin_sub", sub).maybeSingle();
  return data as User | null;
}

export async function findUserByLinkedInUrl(url: string) {
  const normalized = normalizeLinkedInUrl(url);
  if (!normalized) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("linkedin_profile_url", normalized)
    .maybeSingle();
  return data as User | null;
}

export async function findUserByEmail(email: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("users")
    .select("*")
    .ilike("email", email)
    .maybeSingle();
  return data as User | null;
}

export async function findUserById(id: string) {
  const supabase = createAdminClient();
  const { data } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
  return data as User | null;
}

export async function upsertOAuthUser(params: {
  sub: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
  linkedinProfileUrl?: string | null;
  headline?: string | null;
  referrerCode?: string | null;
}) {
  const supabase = createAdminClient();
  const normalizedUrl = normalizeLinkedInUrl(params.linkedinProfileUrl);

  let existing =
    (await findUserByLinkedInSub(params.sub)) ??
    (normalizedUrl ? await findUserByLinkedInUrl(normalizedUrl) : null) ??
    (params.email ? await findUserByEmail(params.email) : null);

  const now = new Date().toISOString();

  if (existing) {
    const updates: Record<string, unknown> = {
      linkedin_sub: params.sub,
      updated_at: now,
    };
    if (params.email) updates.email = params.email;
    if (params.name) updates.full_name = params.name;
    if (params.picture) updates.profile_photo_url = params.picture;
    if (normalizedUrl) updates.linkedin_profile_url = normalizedUrl;
    if (params.headline) updates.job_title = params.headline;
    if (existing.source === "admin") {
      updates.source = "admin";
    }
    // Generate invite code if missing (for pre-existing users)
    if (!existing.invite_code) {
      let code = generateInviteCode();
      // Ensure uniqueness (collision extremely unlikely but handled)
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: collision } = await supabase
          .from("users")
          .select("id")
          .eq("invite_code", code)
          .maybeSingle();
        if (!collision) break;
        code = generateInviteCode();
      }
      updates.invite_code = code;
    }

    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data as User;
  }

  // Generate a unique invite code for the new user
  let inviteCode = generateInviteCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: collision } = await supabase
      .from("users")
      .select("id")
      .eq("invite_code", inviteCode)
      .maybeSingle();
    if (!collision) break;
    inviteCode = generateInviteCode();
  }

  // Resolve referrer if invite code was provided
  let invitedBy: string | null = null;
  if (params.referrerCode) {
    const { data: referrer } = await supabase
      .from("users")
      .select("id")
      .eq("invite_code", params.referrerCode)
      .maybeSingle();
    if (referrer) {
      invitedBy = referrer.id;
    }
  }

  const { data, error } = await supabase
    .from("users")
    .insert({
      linkedin_sub: params.sub,
      email: params.email ?? null,
      full_name: params.name ?? "LinkedIn User",
      profile_photo_url: params.picture ?? null,
      linkedin_profile_url: normalizedUrl,
      job_title: params.headline ?? null,
      source: "oauth",
      visibility: defaultVisibility,
      active_location: "home",
      is_active: true,
      invite_code: inviteCode,
      invited_by: invitedBy,
      network_points: 0,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw error;

  // Post-signup: award points to the inviter & update invite_events
  if (invitedBy && data) {
    // Award 100 points to inviter
    awardPoints(invitedBy, "INVITE_SIGNUP", data.id).catch((e) =>
      console.error("Failed to award invite signup points:", e)
    );

    // Mark matching invite_events as signed_up
    supabase
      .from("invite_events")
      .update({ signed_up: true, invitee_id: data.id })
      .eq("invite_code", params.referrerCode!)
      .eq("signed_up", false)
      .then(({ error: evtErr }) => {
        if (evtErr) console.error("Failed to update invite_events:", evtErr);
      });

    // Check for 2nd-degree: if the inviter was themselves invited, award SECOND_DEGREE_SIGNUP
    const { data: inviterUser } = await supabase
      .from("users")
      .select("invited_by")
      .eq("id", invitedBy)
      .maybeSingle();
    if (inviterUser?.invited_by) {
      awardPoints(inviterUser.invited_by, "SECOND_DEGREE_SIGNUP", data.id).catch((e) =>
        console.error("Failed to award 2nd-degree points:", e)
      );
    }
  }

  return data as User;
}

export async function ensureAdminUser() {
  if (!isSupabaseConfigured()) {
    return {
      id: "dev-admin",
      linkedin_sub: "admin-system",
      email: "admin@proxnet.in",
      full_name: "ProxNet Admin",
      job_title: "System Admin",
      company: "ProxNet",
      source: "admin",
      active_location: "home",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as User;
  }
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("source", "admin")
    .limit(1)
    .maybeSingle();

  if (existing) return existing as User;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("users")
    .insert({
      linkedin_sub: "admin-system",
      email: "admin@proxnet.in",
      full_name: "ProxNet Admin",
      job_title: "System Admin",
      company: "ProxNet",
      source: "admin",
      active_location: "home",
      is_active: true,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as User;
}

export async function ensureNonAdminUser() {
  if (!isSupabaseConfigured()) {
    return {
      id: "dev-user",
      linkedin_sub: "test-user-system",
      email: "testuser@proxnet.in",
      full_name: "ProxNet TestUser",
      company: null,
      job_title: null,
      home_lat: null,
      home_lng: null,
      office_lat: null,
      office_lng: null,
      resume_url: null,
      source: "test-user",
      active_location: "home",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as User;
  }
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("source", "test-user")
    .limit(1)
    .maybeSingle();

  if (existing) return existing as User;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("users")
    .insert({
      linkedin_sub: "test-user-system",
      email: "testuser@proxnet.in",
      full_name: "ProxNet TestUser",
      source: "test-user",
      active_location: "home",
      is_active: true,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as User;
}

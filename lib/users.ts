import { createAdminClient } from "./supabase/admin";
import { normalizeLinkedInUrl } from "./linkedin/normalize-url";
import type { User, UserVisibility } from "./types";

const defaultVisibility: UserVisibility = {
  showCompany: true,
  showTitle: true,
  showPhoto: false,
};

export async function findUserByLinkedInSub(sub: string) {
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
    if (existing.source === "admin") {
      updates.source = "admin";
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

  const { data, error } = await supabase
    .from("users")
    .insert({
      linkedin_sub: params.sub,
      email: params.email ?? null,
      full_name: params.name ?? "LinkedIn User",
      profile_photo_url: params.picture ?? null,
      linkedin_profile_url: normalizedUrl,
      source: "oauth",
      visibility: defaultVisibility,
      active_location: "current",
      is_active: true,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as User;
}

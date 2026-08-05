/**
 * Helper to validate if a user's profile is complete.
 * A profile is considered complete if and only if all mandatory fields are present:
 * - Name (full_name)
 * - Email (email)
 */
export function isProfileIncomplete(user: any): boolean {
  if (!user) return true;
  
  const hasName = !!user.full_name?.trim();
  const hasEmail = !!user.email?.trim();

  return !(
    hasName &&
    hasEmail
  );
}

/**
 * Onboarding validation: checks for the absolute bare minimum required to route
 * users to the main screens instead of blocking them completely.
 * Requires mandatory fields: Name (full_name) and Email (email).
 */
export function isOnboardingIncomplete(user: any): boolean {
  return isProfileIncomplete(user);
}


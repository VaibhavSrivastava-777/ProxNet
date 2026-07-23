/**
 * Helper to validate if a user's profile is complete.
 * A profile is considered complete if and only if all the following 4 fields are present:
 * - Name (full_name)
 * - Email (email)
 * - Company name (company)
 * - Job Title (job_title)
 */
export function isProfileIncomplete(user: any): boolean {
  if (!user) return true;
  
  const hasName = !!user.full_name?.trim();
  const hasEmail = !!user.email?.trim();
  const hasCompany = !!user.company?.trim();
  const hasJobTitle = !!user.job_title?.trim();

  return !(
    hasName &&
    hasEmail &&
    hasCompany &&
    hasJobTitle
  );
}

/**
 * Onboarding validation: checks for the absolute bare minimum required to route
 * users to the main screens instead of blocking them completely.
 * With the relaxed rules, this requires the same 4 mandatory fields:
 * - Name (full_name)
 * - Email (email)
 * - Company name (company)
 * - Job Title (job_title)
 */
export function isOnboardingIncomplete(user: any): boolean {
  return isProfileIncomplete(user);
}

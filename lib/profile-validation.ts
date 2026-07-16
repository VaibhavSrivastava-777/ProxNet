/**
 * Helper to validate if a user's profile is complete.
 * A profile is considered complete if and only if all the following 9 fields are present:
 * - Name (full_name)
 * - Email (email)
 * - Company name (company)
 * - Job Title (job_title)
 * - Resume (resume_url)
 * - Profile photo URL (profile_photo_url)
 * - LinkedIn Profile URL (linkedin_profile_url)
 * - Home Location (home_lat, home_lng)
 * - Office Location (office_lat, office_lng)
 */
export function isProfileIncomplete(user: any): boolean {
  if (!user) return true;
  
  const hasName = !!user.full_name?.trim();
  const hasEmail = !!user.email?.trim();
  const hasCompany = !!user.company?.trim();
  const hasJobTitle = !!user.job_title?.trim();
  const hasResume = !!user.resume_url?.trim();
  const hasPhoto = !!user.profile_photo_url?.trim();
  const hasLinkedIn = !!user.linkedin_profile_url?.trim();
  const hasHomeLocation = user.home_lat != null && user.home_lng != null;
  const hasOfficeLocation = user.office_lat != null && user.office_lng != null;

  return !(
    hasName &&
    hasEmail &&
    hasCompany &&
    hasJobTitle &&
    hasResume &&
    hasPhoto &&
    hasLinkedIn &&
    hasHomeLocation &&
    hasOfficeLocation
  );
}

/**
 * Onboarding validation: checks for the absolute bare minimum required to route
 * users to the main screens instead of blocking them completely.
 * Minimal requirements:
 * - Name (full_name)
 * - Email (email)
 * - Home Location (home_lat, home_lng)
 */
export function isOnboardingIncomplete(user: any): boolean {
  if (!user) return true;
  
  const hasName = !!user.full_name?.trim();
  const hasEmail = !!user.email?.trim();
  const hasHomeLocation = user.home_lat != null && user.home_lng != null;
  const hasLinkedIn = !!user.linkedin_profile_url?.trim();
  const hasCompany = !!user.company?.trim();
  const hasJobTitle = !!user.job_title?.trim();

  return !(
    hasName &&
    hasEmail &&
    hasHomeLocation &&
    hasLinkedIn &&
    hasCompany &&
    hasJobTitle
  );
}

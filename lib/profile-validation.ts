/**
 * Helper to validate user profile completeness and onboarding requirements.
 */

export interface OnboardingRequirements {
  hasName: boolean;
  hasEmail: boolean;
  hasDesignation: boolean;
  hasCompany: boolean;
  hasHomeLocation: boolean;
}

/**
 * Returns breakdown of minimum onboarding requirements:
 * 1. Name (full_name)
 * 2. Email (email)
 * 3. Designation (job_title)
 * 4. Company Name (company)
 * 5. Home Location (home_lat + home_lng or home_name)
 */
export function checkOnboardingRequirements(user: any): OnboardingRequirements {
  if (!user) {
    return {
      hasName: false,
      hasEmail: false,
      hasDesignation: false,
      hasCompany: false,
      hasHomeLocation: false,
    };
  }

  const hasName = !!user.full_name?.trim();
  const hasEmail = !!user.email?.trim();
  const hasDesignation = !!user.job_title?.trim();
  const hasCompany = !!user.company?.trim();
  const hasHomeLocation =
    (user.home_lat != null &&
      user.home_lng != null &&
      !isNaN(Number(user.home_lat)) &&
      !isNaN(Number(user.home_lng))) ||
    !!user.home_name?.trim();

  return {
    hasName,
    hasEmail,
    hasDesignation,
    hasCompany,
    hasHomeLocation,
  };
}

/**
 * Onboarding validation:
 * Keeps minimum bar of name, email, designation, company name and Home location.
 * If any of these 5 fields is missing, user is redirected to profile onboarding.
 */
export function isOnboardingIncomplete(user: any): boolean {
  if (!user) return true;
  const reqs = checkOnboardingRequirements(user);
  return !(
    reqs.hasName &&
    reqs.hasEmail &&
    reqs.hasDesignation &&
    reqs.hasCompany &&
    reqs.hasHomeLocation
  );
}

/**
 * Backward-compatible profile incomplete check.
 */
export function isProfileIncomplete(user: any): boolean {
  return isOnboardingIncomplete(user);
}

export interface CompletenessItem {
  key: string;
  label: string;
  weight: number;
  completed: boolean;
  sectionId?: string;
}

/**
 * Detailed weighted breakdown of 10 profile areas (10% each = 100% total)
 */
export function getProfileCompletenessItems(user: any): CompletenessItem[] {
  if (!user) return [];

  const reqs = checkOnboardingRequirements(user);
  const hasLinkedIn = !!user.linkedin_profile_url?.trim();
  const hasPhoto = !!user.profile_photo_url?.trim();
  const hasBio = !!(user.professional_bio?.trim() || user.about?.trim());
  const hasResume = !!(user.resume_url?.trim() || user.resume_text?.trim());
  const hasSocial = !!(
    (Array.isArray(user.help_offers) && user.help_offers.length > 0) ||
    (Array.isArray(user.tinkering_with) && user.tinkering_with.length > 0) ||
    (Array.isArray(user.ask_me_about) && user.ask_me_about.length > 0) ||
    user.society_name?.trim() ||
    user.quick_chat_preference
  );

  return [
    { key: "full_name", label: "Full Name", weight: 10, completed: reqs.hasName, sectionId: "section-personal" },
    { key: "email", label: "Email Address", weight: 10, completed: reqs.hasEmail, sectionId: "section-personal" },
    { key: "job_title", label: "Designation / Role", weight: 10, completed: reqs.hasDesignation, sectionId: "section-personal" },
    { key: "company", label: "Company Name", weight: 10, completed: reqs.hasCompany, sectionId: "section-personal" },
    { key: "home_location", label: "Home Location", weight: 10, completed: reqs.hasHomeLocation, sectionId: "section-location" },
    { key: "linkedin", label: "LinkedIn Profile", weight: 10, completed: hasLinkedIn, sectionId: "section-personal" },
    { key: "photo", label: "Profile Photo", weight: 10, completed: hasPhoto, sectionId: "section-personal" },
    { key: "bio", label: "Professional Bio", weight: 10, completed: hasBio, sectionId: "section-personal" },
    { key: "resume", label: "Resume Upload", weight: 10, completed: hasResume, sectionId: "section-personal" },
    { key: "social", label: "Neighbor Scrapbook", weight: 10, completed: hasSocial, sectionId: "section-scrapbook" },
  ];
}

/**
 * Calculates profile completeness as an integer percentage from 0 to 100.
 */
export function calculateProfileCompleteness(user: any): number {
  if (!user) return 0;
  const items = getProfileCompletenessItems(user);
  const totalCompleted = items.reduce((acc, item) => (item.completed ? acc + item.weight : acc), 0);
  return Math.min(100, Math.max(0, Math.round(totalCompleted)));
}

/**
 * Returns labels of missing fields for helpful prompts.
 */
export function getMissingProfileFields(user: any): string[] {
  const items = getProfileCompletenessItems(user);
  return items.filter((item) => !item.completed).map((item) => item.label);
}

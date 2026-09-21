import type { User } from "./types";
import { isSyntheticLinkedInUrl } from "./linkedin/normalize-url";

export type ProfileWizardStepId =
  | "linkedin_url"
  | "designation"
  | "company"
  | "about_me"
  | "home_location"
  | "office_location"
  | "notifications";

export interface ProfileWizardStepConfig {
  id: ProfileWizardStepId;
  title: string;
  subtitle: string;
  badge: string;
  icon: string;
}

export const PROFILE_WIZARD_STEPS_CONFIG: Record<ProfileWizardStepId, ProfileWizardStepConfig> = {
  linkedin_url: {
    id: "linkedin_url",
    title: "Connect your LinkedIn profile",
    subtitle: "We'll automatically extract your role, company, and bio to save you time.",
    badge: "LinkedIn",
    icon: "🔗",
  },
  designation: {
    id: "designation",
    title: "What is your current role?",
    subtitle: "Your designation helps colleagues and nearby peers identify your expertise.",
    badge: "Role",
    icon: "💼",
  },
  company: {
    id: "company",
    title: "Where do you work?",
    subtitle: "Connect with colleagues in your company and discover mutual office connections.",
    badge: "Company",
    icon: "🏢",
  },
  about_me: {
    id: "about_me",
    title: "Write a brief About Me summary",
    subtitle: "A 2–3 sentence introduction about your background and what you enjoy discussing.",
    badge: "About Me",
    icon: "✍️",
  },
  home_location: {
    id: "home_location",
    title: "Where is your home neighborhood?",
    subtitle: "Powers neighborhood chai/walk beacons, local forum discussions, and nearby peer discovery.",
    badge: "Neighborhood",
    icon: "🏡",
  },
  office_location: {
    id: "office_location",
    title: "Where is your workplace / tech park?",
    subtitle: "Powers carpooling routes, lunch meetups, and discovery of peers in your tech park.",
    badge: "Workplace",
    icon: "📍",
  },
  notifications: {
    id: "notifications",
    title: "Stay updated with instant alerts",
    subtitle: "Get notified immediately when someone near you drops a beacon or joins your chat.",
    badge: "Notifications",
    icon: "🔔",
  },
};

/**
 * Returns the array of missing steps in prioritized order.
 * Only returns steps that have not yet been completed.
 */
export function getMissingProfileWizardSteps(
  user: Partial<User> | null,
  notificationsGranted: boolean = false
): ProfileWizardStepId[] {
  if (!user) {
    return [
      "linkedin_url",
      "designation",
      "company",
      "about_me",
      "home_location",
      "office_location",
    ];
  }

  const missing: ProfileWizardStepId[] = [];

  // 1. LinkedIn Profile URL (missing or synthetic sub token)
  const hasValidLinkedIn =
    Boolean(user.linkedin_profile_url?.trim()) &&
    !isSyntheticLinkedInUrl(user.linkedin_profile_url, user.linkedin_sub);
  if (!hasValidLinkedIn) {
    missing.push("linkedin_url");
  }

  // 2. Designation
  if (!user.job_title?.trim()) {
    missing.push("designation");
  }

  // 3. Company
  if (!user.company?.trim()) {
    missing.push("company");
  }

  // 4. About Me / Bio
  const hasBio = Boolean(user.about?.trim() || user.professional_bio?.trim());
  if (!hasBio) {
    missing.push("about_me");
  }

  // 5. Home Location
  const hasHome = user.home_lat != null && user.home_lng != null && Number(user.home_lat) !== 0;
  if (!hasHome) {
    missing.push("home_location");
  }

  // 6. Office Location
  const hasOffice = user.office_lat != null && user.office_lng != null && Number(user.office_lat) !== 0;
  if (!hasOffice) {
    missing.push("office_location");
  }

  // 7. Notifications (only if not already granted)
  const isAndroidBridge = typeof window !== "undefined" && Boolean((window as any).AndroidBridge);
  const isPushClaimed = Boolean(
    (user as any)?.profile_digest?.push_reward_claimed ||
    (user as any)?.push_reward_claimed ||
    (user as any)?.profile_digest?.rewarded_actions?.includes("push_notifications_enabled")
  );

  if (!notificationsGranted && !isPushClaimed && !isAndroidBridge) {
    missing.push("notifications");
  }

  return missing;
}

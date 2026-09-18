import type { User } from "./types";

export type ProfileWizardStepId =
  | "designation"
  | "company"
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
  designation: {
    id: "designation",
    title: "What is your current role?",
    subtitle: "Your designation helps colleagues and nearby peers identify your expertise.",
    badge: "Step 1: Role",
    icon: "💼",
  },
  company: {
    id: "company",
    title: "Where do you work?",
    subtitle: "Connect with colleagues in your company and discover mutual office connections.",
    badge: "Step 2: Company",
    icon: "🏢",
  },
  home_location: {
    id: "home_location",
    title: "Where is your home neighborhood?",
    subtitle: "Powers neighborhood chai/walk beacons, local forum discussions, and nearby peer discovery.",
    badge: "Step 3: Neighborhood",
    icon: "🏡",
  },
  office_location: {
    id: "office_location",
    title: "Where is your workplace / tech park?",
    subtitle: "Powers carpooling routes, lunch meetups, and discovery of peers in your tech park.",
    badge: "Step 4: Workplace",
    icon: "📍",
  },
  notifications: {
    id: "notifications",
    title: "Stay updated with instant alerts",
    subtitle: "Get notified immediately when someone near you drops a beacon or joins your chat.",
    badge: "Step 5: Notifications",
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
  if (!user) return ["designation", "company", "home_location", "office_location"];

  const missing: ProfileWizardStepId[] = [];

  // 1. Designation
  if (!user.job_title?.trim()) {
    missing.push("designation");
  }

  // 2. Company
  if (!user.company?.trim()) {
    missing.push("company");
  }

  // 3. Home Location
  const hasHome = user.home_lat != null && user.home_lng != null && Number(user.home_lat) !== 0;
  if (!hasHome) {
    missing.push("home_location");
  }

  // 4. Office Location
  const hasOffice = user.office_lat != null && user.office_lng != null && Number(user.office_lat) !== 0;
  if (!hasOffice) {
    missing.push("office_location");
  }

  // 5. Notifications (only if not already granted)
  if (!notificationsGranted) {
    missing.push("notifications");
  }

  return missing;
}

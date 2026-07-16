/**
 * Network Score — Tiers, Points Config, and Badge Definitions
 *
 * This module defines the gamification system for ProxNet's invite/growth feature.
 * Points are earned through invite signups, invitee activity, streaks, and milestones.
 * Tiers are calculated from cumulative points. Badges are unlocked by specific achievements.
 */

// ── Points Configuration ──

export const POINTS_CONFIG = {
  /** Someone signs up through your invite */
  INVITE_SIGNUP: 100,
  /** Your invitee posts their first question or forum post */
  INVITEE_FIRST_POST: 50,
  /** Your invitee gives their first job referral */
  INVITEE_FIRST_REFERRAL: 75,
  /** Your invitee's invitee signs up (2nd degree) */
  SECOND_DEGREE_SIGNUP: 25,
  /** Shared invite 3+ times in one week */
  WEEKLY_STREAK: 30,
  /** Your area reaches a milestone (10/25/50 professionals) */
  LOCALITY_MILESTONE: 200,
} as const;

export type PointReason = keyof typeof POINTS_CONFIG;

// ── Tier System ──

export interface Tier {
  level: number;
  name: string;
  badge: string;
  minPoints: number;
}

export const TIERS: Tier[] = [
  { level: 1, name: "Seedling",   badge: "🌱", minPoints: 0 },
  { level: 2, name: "Connector",  badge: "🌿", minPoints: 300 },
  { level: 3, name: "Builder",    badge: "🌳", minPoints: 1000 },
  { level: 4, name: "Architect",  badge: "🏗️", minPoints: 3000 },
  { level: 5, name: "Catalyst",   badge: "🌐", minPoints: 10000 },
];

export function calculateTier(points: number): Tier {
  let tier = TIERS[0];
  for (const t of TIERS) {
    if (points >= t.minPoints) tier = t;
    else break;
  }
  return tier;
}

export function getNextTierProgress(points: number): {
  currentTier: Tier;
  nextTier: Tier | null;
  progressPercent: number;
  pointsToNext: number;
} {
  const currentTier = calculateTier(points);
  const nextIdx = TIERS.findIndex((t) => t.level === currentTier.level) + 1;
  const nextTier = nextIdx < TIERS.length ? TIERS[nextIdx] : null;

  if (!nextTier) {
    return { currentTier, nextTier: null, progressPercent: 100, pointsToNext: 0 };
  }

  const range = nextTier.minPoints - currentTier.minPoints;
  const progress = points - currentTier.minPoints;
  const progressPercent = Math.min(100, Math.round((progress / range) * 100));
  const pointsToNext = nextTier.minPoints - points;

  return { currentTier, nextTier, progressPercent, pointsToNext };
}

export function getTierBadge(points: number): string {
  return calculateTier(points).badge;
}

// ── Badge / Achievement System ──

export interface Badge {
  id: string;
  icon: string;
  name: string;
  description: string;
}

export const BADGES: Badge[] = [
  {
    id: "first_neighbor",
    icon: "🏠",
    name: "First Neighbor",
    description: "Your first successful invite signed up",
  },
  {
    id: "streak_master",
    icon: "🔥",
    name: "Streak Master",
    description: "Shared 3+ times in one week",
  },
  {
    id: "tree_planter",
    icon: "🌳",
    name: "Tree Planter",
    description: "5+ of your invitees are actively using ProxNet",
  },
  {
    id: "matchmaker",
    icon: "🎯",
    name: "Matchmaker",
    description: "Your invitee got a carpool or job match",
  },
  {
    id: "building_pioneer",
    icon: "🏗️",
    name: "Building Pioneer",
    description: "You were the first person in your complex on ProxNet",
  },
  {
    id: "network_effect",
    icon: "🌐",
    name: "Network Effect",
    description: "Your invitee invited someone else (2nd degree growth)",
  },
];

/**
 * Compute which badges the user has earned based on their stats.
 * In a full implementation these stats come from aggregate DB queries;
 * here we accept a pre-computed stats object.
 */
export function computeEarnedBadges(stats: {
  totalSignups: number;
  activeInvitees: number;
  hasStreak: boolean;
  inviteeGotMatch: boolean;
  isBuildingPioneer: boolean;
  hasSecondDegree: boolean;
}): Badge[] {
  const earned: Badge[] = [];

  if (stats.totalSignups >= 1) earned.push(BADGES.find((b) => b.id === "first_neighbor")!);
  if (stats.hasStreak) earned.push(BADGES.find((b) => b.id === "streak_master")!);
  if (stats.activeInvitees >= 5) earned.push(BADGES.find((b) => b.id === "tree_planter")!);
  if (stats.inviteeGotMatch) earned.push(BADGES.find((b) => b.id === "matchmaker")!);
  if (stats.isBuildingPioneer) earned.push(BADGES.find((b) => b.id === "building_pioneer")!);
  if (stats.hasSecondDegree) earned.push(BADGES.find((b) => b.id === "network_effect")!);

  return earned;
}

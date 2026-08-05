export interface OnboardingStep {
  id: string;
  target?: string; // CSS selector of element to highlight
  title: string;
  description: string;
  tabHref?: string; // Tab URL to switch to if needed
  placement?: "top" | "bottom" | "left" | "right" | "center";
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "network",
    target: '[data-tour="nav-network"]',
    title: "📍 Your Neighborhood",
    description: "See professionals near you on the map. Discover neighbors who share your company, alma mater, or interests.",
    tabHref: "/network",
    placement: "bottom",
  },
  {
    id: "jobs",
    target: '[data-tour="nav-jobs"]',
    title: "💼 Job Referrals",
    description: "Browse open roles and request anonymous referrals from verified insiders at top companies near you.",
    tabHref: "/jobs",
    placement: "bottom",
  },
  {
    id: "chats",
    target: '[data-tour="nav-chats"]',
    title: "💬 Anonymous Chats",
    description: "Ask questions to specific professionals or roles. All chats are anonymous — honest, bias-free conversations.",
    tabHref: "/qa",
    placement: "bottom",
  },
  {
    id: "forum",
    target: '[data-tour="nav-forum"]',
    title: "🏘️ Local Forum",
    description: "Post discussions, neighborhood updates, or host meetups. Your local community bulletin board.",
    tabHref: "/forum",
    placement: "bottom",
  },
  {
    id: "user-menu",
    target: '[data-tour="user-menu"]',
    title: "👤 Profile & Settings",
    description: "Access your profile, check your wallet credits, or replay this tour anytime from your user menu.",
    placement: "bottom",
  },
  {
    id: "theme-toggle",
    target: '[data-tour="theme-toggle"]',
    title: "🎨 Theme Switcher",
    description: "Switch seamlessly between Light, Dark, or System theme with a single tap.",
    placement: "bottom",
  },
  {
    id: "finish",
    title: "🚀 You're All Set!",
    description: "Start exploring your professional neighborhood. Everything you do on ProxNet is anonymous by default. Welcome aboard!",
    placement: "center",
  },
];

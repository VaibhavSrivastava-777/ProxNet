export type UserSource = "oauth" | "admin";
export type ActiveLocation = "home" | "office" | "current";
export type QuestionStatus = "open" | "closed";
export type TargetStatus = "pending" | "viewed" | "responded" | "declined";

export interface UserVisibility {
  showCompany: boolean;
  showTitle: boolean;
  showPhoto: boolean;
}

export interface User {
  id: string;
  linkedin_sub: string | null;
  linkedin_profile_url: string | null;
  email: string | null;
  full_name: string;
  company: string | null;
  job_title: string | null;
  about: string | null;
  professional_bio: string | null;
  resume_url: string | null;
  resume_text: string | null;
  profile_photo_url: string | null;
  source: UserSource;
  visibility: UserVisibility;
  phone_number: string | null;
  home_name: string | null;
  home_lat: number | null;
  home_lng: number | null;
  office_name: string | null;
  office_lat: number | null;
  office_lng: number | null;
  active_location: ActiveLocation;
  is_active: boolean;
  is_blocked: boolean;
  invite_code: string | null;
  invited_by: string | null;
  network_points: number;
  anonymous_name: string | null;
  embedding: number[] | null;
  wallet: number;
  tags: string[];
  help_offers?: string[];
  tinkering_with?: string[];
  ask_me_about?: string[];
  quick_chat_preference?: "chai" | "walk" | "weekend_coffee" | "dm_only" | string | null;
  society_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  asker_id: string;
  body: string;
  company_filter: string | null;
  title_filter: string | null;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  status: QuestionStatus;
  created_at: string;
}

export interface QuestionTarget {
  id: string;
  question_id: string;
  professional_id: string;
  status: TargetStatus;
}

export interface ChatSession {
  id: string;
  question_id: string | null;
  created_at: string;
}

export interface ChatParticipant {
  session_id: string;
  user_id: string;
  alias: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface CompanyCluster {
  company: string;
  logoUrl: string;
  count: number;
  lat: number;
  lng: number;
  titles?: Record<string, number>;
}

export interface Institute {
  id: string;
  name: string;
  short_code: string | null;
  verified_domains: string[];
  logo_url: string | null;
  category: "iit" | "iim" | "nit" | "bits" | "iiit" | "university" | "other" | string;
  created_at: string;
}

export interface UserInstituteAffiliation {
  id: string;
  user_id: string;
  institute_id: string;
  degree: string | null;
  batch_year: number | null;
  verification_status: "verified_domain" | "verified_manual" | "unverified";
  verified_at: string | null;
  created_at: string;
  institute?: Institute;
}

export interface MicroStatus {
  id: string;
  user_id: string;
  activity: "chai" | "walk" | "sports" | "quick_chat";
  note: string | null;
  lat: number;
  lng: number;
  distance?: number | null;
  created_at: string;
  expires_at: string;
  duration_mins?: number;
  user?: Partial<User>;
}

export interface SocietyStats {
  society_name: string;
  total_members: number;
  roles_breakdown: Record<string, number>;
  top_companies: { name: string; count: number }[];
  top_institutes: { name: string; count: number }[];
  top_help_offers: { topic: string; count: number }[];
  members: {
    id: string;
    full_name: string;
    company: string | null;
    job_title: string | null;
    profile_photo_url: string | null;
    help_offers?: string[];
    tinkering_with?: string[];
    ask_me_about?: string[];
    quick_chat_preference?: string | null;
    institute_affiliation?: string | null;
  }[];
}


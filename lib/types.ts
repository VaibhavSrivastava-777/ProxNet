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
}

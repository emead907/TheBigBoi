export type Role = 'owner' | 'staff';
export type TrialStatus = 'open' | 'enrolled' | 'not_enrolling' | 'no_show';
export type Channel = 'email' | 'sms';
export type TrialTemplateKey = 'spot_ready' | 'first_day_reminder' | 'follow_up' | 'follow_up_2';
export type PartyTemplateKey = 'party_inquiry' | 'party_confirmation' | 'party_reminder' | 'party_thank_you';
export type TemplateKey = TrialTemplateKey | PartyTemplateKey;
export const TRIAL_KEYS: TrialTemplateKey[] = ['spot_ready', 'first_day_reminder', 'follow_up', 'follow_up_2'];
export const PARTY_KEYS: PartyTemplateKey[] = ['party_inquiry', 'party_confirmation', 'party_reminder', 'party_thank_you'];
export type Source = 'website' | 'email' | 'manual' | 'phone' | 'walk_in';

export interface Gym {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  phone: string | null;
  email: string | null;
  from_email: string | null;
  sms_from: string | null;
  address: string | null;
  website: string | null;
  timezone: string;
  brand_color: string;
  accent_color: string;
  intake_key: string;
}

export interface Membership {
  gym_id: string;
  user_id: string;
  role: Role;
  display_name: string | null;
  gyms?: Gym;
}

export interface Trial {
  id: string;
  gym_id: string;
  source: Source;
  received_at: string;
  child_name: string;
  birthday: string | null;
  class_name: string | null;
  requested_time: string | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  zip: string | null;
  sms_opt_in: boolean;
  in_sportsengine: boolean;
  spot_email_sent_at: string | null;
  called_at: string | null;
  first_day: string | null;
  first_day_time: string | null;
  showed_up: boolean | null;
  status: TrialStatus;
  followed_up_at: string | null;
  closed_at: string | null;
  notes: string | null;
  reminder_sent_at: string | null;
  waitlisted_at: string | null;
  offered_at: string | null;
  followup_sent_at: string | null;
  followup2_sent_at?: string | null;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: number;
  trial_id: string;
  actor: string | null;
  kind: string;
  detail: string | null;
  created_at: string;
}

export interface Template {
  gym_id: string;
  key: TemplateKey;
  channel: Channel;
  subject: string | null;
  body: string;
  auto_send: boolean;
}

export interface Message {
  id: string;
  trial_id: string;
  channel: Channel;
  template_key: string | null;
  to_address: string;
  subject: string | null;
  body: string;
  status: 'sent' | 'failed' | 'not_configured';
  error: string | null;
  created_at: string;
}

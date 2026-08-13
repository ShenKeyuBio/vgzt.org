import { parse } from 'yaml';
import siteSource from '../data/site.yml?raw';
import socialSource from '../data/social.yml?raw';
import sessionSource from '../data/session-types.yml?raw';
import abstractCallSource from '../data/abstract-call.yml?raw';

export interface SiteSettings {
  site: string;
  name: string;
  shortName: string;
  description: string;
  currentSeason: string;
  publicEmail: string;
  contactEndpoint: string | null;
  turnstileSiteKey: string | null;
  masterLogo: string | null;
}

export interface SocialSettings {
  newsletterUrl: string | null;
  slackInviteUrl: string | null;
  linkedinUrl: string | null;
  blueskyUrl: string | null;
  xUrl: string | null;
}

export interface SessionTypeSettings {
  id: string;
  label: string;
  speakerCount: number;
  totalDurationMinutes: number;
  presentationMinutesPerSpeaker: number;
  qaMinutesPerSpeaker: number;
  description: string;
}

export interface TimeSlotSettings {
  id: 'eastern' | 'western' | 'alternative';
  label: string;
  time: string;
}

export interface SessionSettings {
  sessionTypes: SessionTypeSettings[];
  timeSlots: TimeSlotSettings[];
}

export interface AbstractDeadline {
  date: string;
  time: string;
  timezone: string;
}

export interface AbstractFaqItem {
  question: string;
  answer: string;
}

export interface AbstractCallSettings {
  open: boolean;
  season: string;
  audience: string;
  deadline: AbstractDeadline | null;
  formUrl: string | null;
  description: string | null;
  eligibility: string | null;
  whatToSubmit: string[];
  reviewDescription: string | null;
  preferredTimeSlots: string[];
  faq: AbstractFaqItem[];
}

function parseData<T>(source: string): T {
  return parse(source) as T;
}

export function getSiteSettings(): SiteSettings {
  return parseData<SiteSettings>(siteSource);
}

export function getSocialSettings(): SocialSettings {
  return parseData<SocialSettings>(socialSource);
}

export function getSessionSettings(): SessionSettings {
  return parseData<SessionSettings>(sessionSource);
}

export function getAbstractCallSettings(): AbstractCallSettings {
  return parseData<AbstractCallSettings>(abstractCallSource);
}

export function getFooterSocial(settings: SocialSettings) {
  return [
    { label: 'Slack', url: settings.slackInviteUrl },
    { label: 'LinkedIn', url: settings.linkedinUrl },
    { label: 'Bluesky', url: settings.blueskyUrl },
    { label: 'X', url: settings.xUrl },
  ];
}

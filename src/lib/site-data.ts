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
  newsletterEmbedScriptUrl: string | null;
  newsletterFormId: string | null;
  slackInviteUrl: string | null;
  linkedinUrl: string | null;
  blueskyUrl: string | null;
  xUrl: string | null;
  instagramUrl: string | null;
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

export interface AbstractSubmissionMilestone {
  label: string;
  date: string;
}

export interface AbstractFaqItem {
  question: string;
  answer: string;
}

export interface AbstractCallSettings {
  state: 'opening-soon' | 'open' | 'closed';
  season: string;
  audience: string;
  submissionTimeline: AbstractSubmissionMilestone[];
  rollingLabel: string;
  formUrl: string | null;
  fallbackFormUrl: string | null;
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
  const hasNewsletterEmbed = Boolean(
    settings.newsletterEmbedScriptUrl && settings.newsletterFormId,
  );
  return [
    {
      label: 'Mailing list',
      url:
        settings.newsletterUrl || (hasNewsletterEmbed ? '/subscribe/' : null),
      external: Boolean(settings.newsletterUrl),
    },
    {
      label: 'Slack',
      url: settings.slackInviteUrl ? '/subscribe/' : null,
      external: false,
    },
    { label: 'LinkedIn', url: settings.linkedinUrl, external: true },
    { label: 'Bluesky', url: settings.blueskyUrl, external: true },
    { label: 'X', url: settings.xUrl, external: true },
    { label: 'Instagram', url: settings.instagramUrl, external: true },
  ];
}

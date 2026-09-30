export interface SpeakerViewModel {
  id: string;
  name: string;
  role?: string | null;
  talkTitle?: string | null;
  affiliation?: string | null;
}

export interface EventViewModel {
  id: string;
  slug: string;
  instant: string;
  endInstant: string;
  canonicalDate: string;
  canonicalTime: string;
  timezone: string;
  durationMinutes: number;
  sessionType: string;
  timeSlot: string;
  posterSrc: string;
  posterAlt: string;
  speakers: SpeakerViewModel[];
  recordingUrl?: string | null;
}

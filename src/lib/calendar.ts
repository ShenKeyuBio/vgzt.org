import { canonicalEventInstant, eventEndInstant } from './time.ts';

export interface SessionAccess {
  url: string;
  meetingId: string;
  passcode: string;
}

export interface CalendarSession {
  id: string;
  date: string;
  time: string;
  timezone: string;
  durationMinutes: number;
  speakers: {
    name: string;
    affiliation?: string | null;
    talkTitle?: string | null;
  }[];
  access?: SessionAccess | null;
}

export function accessError(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'object')
    return 'Zoom access must be an object or null.';
  const access = value as SessionAccess;
  if (
    ![access.url, access.meetingId, access.passcode].every(
      (v) => typeof v === 'string' && v.trim().length > 0 && !/[\r\n]/.test(v),
    )
  )
    return 'Zoom URL, meeting ID and passcode must all be explicitly supplied.';
  try {
    const url = new URL(access.url);
    if (
      url.protocol !== 'https:' ||
      !(url.hostname === 'zoom.us' || url.hostname.endsWith('.zoom.us')) ||
      url.username ||
      url.password ||
      access.url !== access.url.trim()
    )
      return 'Use the complete HTTPS Zoom URL.';
    const meeting = url.pathname.match(/^\/j\/(\d+)\/?$/)?.[1];
    if (!meeting || meeting !== access.meetingId.replace(/[\s-]/g, ''))
      return 'The meeting ID must match the Zoom URL.';
  } catch {
    return 'Use the complete HTTPS Zoom URL.';
  }
  return null;
}

export function escapeIcs(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,');
}

// Fold bytes, not UTF-16 code units. The continuation marker counts toward 75.
export function foldIcs(line: string): string {
  let result = '';
  let bytes = 0;
  for (const char of line) {
    const length = new TextEncoder().encode(char).length;
    if (bytes + length > 75) {
      result += '\r\n ';
      bytes = 1;
    }
    result += char;
    bytes += length;
  }
  return result;
}

function utc(value: string): string {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

export function sessionCalendar(
  event: CalendarSession,
  site: string | URL,
  generatedAt = new Date(),
  uid = `${event.id}@vgzt.org`,
): string {
  const invalid = accessError(event.access);
  if (invalid) throw new Error(invalid);
  const details = event.speakers.map(
    (speaker) =>
      `${speaker.name}${speaker.affiliation ? ` (${speaker.affiliation})` : ''}${speaker.talkTitle ? `: ${speaker.talkTitle}` : ''}`,
  );
  if (event.access)
    details.push(
      `Zoom: ${event.access.url}`,
      `Meeting ID: ${event.access.meetingId}`,
      `Passcode: ${event.access.passcode}`,
    );
  else
    details.push(
      'Access is shared with VGZT subscribers and community members.',
    );
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VGZT//Session calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcs(uid)}`,
    `DTSTAMP:${utc(generatedAt.toISOString())}`,
    `DTSTART:${utc(canonicalEventInstant(event).toString())}`,
    `DTEND:${utc(eventEndInstant(event).toString())}`,
    `SUMMARY:${escapeIcs(`VGZT: ${event.speakers.map((s) => s.name).join(' & ')}`)}`,
    `DESCRIPTION:${escapeIcs(details.join('\n'))}`,
    'LOCATION:Zoom',
    `URL:${event.access?.url ?? new URL(`/events/${event.id}/`, site).href}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ]
    .map(foldIcs)
    .join('\r\n');
}

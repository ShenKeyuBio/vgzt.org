import { Temporal } from '@js-temporal/polyfill';

export const VGZT_TIME_ZONE = 'America/New_York';

export interface ScheduledEventTime {
  date: string;
  time: string;
  timezone: string;
  durationMinutes?: number;
}

export interface ZonedEventParts {
  date: string;
  time: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
  timeZone: string;
  offset: string;
  abbreviation: string;
}

export type InstantInput = Temporal.Instant | Date | string;

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

function parseDate(value: string): {
  year: number;
  month: number;
  day: number;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null)
    throw new RangeError(`Invalid date "${value}"; use YYYY-MM-DD.`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  Temporal.PlainDate.from({ year, month, day }, { overflow: 'reject' });
  return { year, month, day };
}

function parseTime(value: string): { hour: number; minute: number } {
  const match = /^(?:([01]\d|2[0-3])):([0-5]\d)$/.exec(value);
  if (match === null)
    throw new RangeError(`Invalid time "${value}"; use 24-hour HH:mm.`);
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function coerceInstant(value: InstantInput): Temporal.Instant {
  if (value instanceof Temporal.Instant) return value;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime()))
      throw new RangeError('Invalid Date supplied.');
    return Temporal.Instant.fromEpochMilliseconds(value.getTime());
  }
  return Temporal.Instant.from(value);
}

export function canonicalEventDateTime(
  event: ScheduledEventTime,
): Temporal.ZonedDateTime {
  if (!isValidTimeZone(event.timezone)) {
    throw new RangeError(`Invalid IANA timezone "${event.timezone}".`);
  }

  const date = parseDate(event.date);
  const time = parseTime(event.time);
  return Temporal.ZonedDateTime.from(
    { ...date, ...time, second: 0, millisecond: 0, timeZone: event.timezone },
    { disambiguation: 'reject', overflow: 'reject' },
  );
}

export function canonicalEventInstant(
  event: ScheduledEventTime,
): Temporal.Instant {
  return canonicalEventDateTime(event).toInstant();
}

export function eventEndInstant(event: ScheduledEventTime): Temporal.Instant {
  const durationMinutes = event.durationMinutes ?? 60;
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new RangeError(
      'Event duration must be a positive integer number of minutes.',
    );
  }
  return canonicalEventInstant(event).add({ minutes: durationMinutes });
}

function timeZoneAbbreviation(
  instant: Temporal.Instant,
  timeZone: string,
  locale: string,
): string {
  const part = new Intl.DateTimeFormat(locale, {
    timeZone,
    timeZoneName: 'short',
  })
    .formatToParts(new Date(Number(instant.epochMilliseconds)))
    .find(({ type }) => type === 'timeZoneName');
  return part?.value ?? timeZone;
}

export function eventPartsInZone(
  event: ScheduledEventTime,
  viewerTimeZone: string,
  locale = 'en-GB',
): ZonedEventParts {
  if (!isValidTimeZone(viewerTimeZone)) {
    throw new RangeError(`Invalid viewer timezone "${viewerTimeZone}".`);
  }

  const instant = canonicalEventInstant(event);
  const local = instant.toZonedDateTimeISO(viewerTimeZone);
  return {
    date: `${local.year}-${pad(local.month)}-${pad(local.day)}`,
    time: `${pad(local.hour)}:${pad(local.minute)}`,
    year: local.year,
    month: local.month,
    day: local.day,
    hour: local.hour,
    minute: local.minute,
    weekday: local.dayOfWeek,
    timeZone: viewerTimeZone,
    offset: local.offset,
    abbreviation: timeZoneAbbreviation(instant, viewerTimeZone, locale),
  };
}

export interface FormattedEventTime {
  local: ZonedEventParts & { dateLabel: string; timeLabel: string };
  reference: ZonedEventParts & { dateLabel: string; timeLabel: string };
}

export const GLOBAL_SESSION_TIME_ZONES = [
  { timeZone: 'America/New_York', label: 'ET' },
  { timeZone: 'Europe/Paris', label: 'Europe' },
  { timeZone: 'Europe/London', label: 'UK' },
  { timeZone: 'Asia/Shanghai', label: 'China' },
  { timeZone: 'Asia/Kolkata', label: 'India' },
  { timeZone: 'Asia/Tokyo', label: 'Japan' },
  { timeZone: 'Australia/Sydney', label: 'Sydney' },
] as const;

export interface GlobalSessionTime {
  timeZone: (typeof GLOBAL_SESSION_TIME_ZONES)[number]['timeZone'];
  label: (typeof GLOBAL_SESSION_TIME_ZONES)[number]['label'];
  time: string;
  abbreviation: string;
  dayOffset: number;
}

function globalSessionAbbreviation(
  instant: Temporal.Instant,
  timeZone: string,
): string {
  const offset = instant.toZonedDateTimeISO(timeZone).offset;

  switch (timeZone) {
    case 'America/New_York':
      return 'ET';
    case 'Europe/Paris':
      return offset === '+02:00' ? 'CEST' : 'CET';
    case 'Europe/London':
      return offset === '+01:00' ? 'BST' : 'GMT';
    case 'Asia/Shanghai':
      return 'CST';
    case 'Asia/Kolkata':
      return 'IST';
    case 'Asia/Tokyo':
      return 'JST';
    case 'Australia/Sydney':
      return offset === '+11:00' ? 'AEDT' : 'AEST';
    default:
      return timeZoneAbbreviation(instant, timeZone, 'en-GB');
  }
}

export function formatGlobalSessionTimes(
  event: ScheduledEventTime,
): GlobalSessionTime[] {
  const instant = canonicalEventInstant(event);
  const referenceDate = instant
    .toZonedDateTimeISO(event.timezone)
    .toPlainDate();

  return GLOBAL_SESSION_TIME_ZONES.map(({ timeZone, label }) => {
    const local = instant.toZonedDateTimeISO(timeZone);
    const localDate = local.toPlainDate();
    return {
      timeZone,
      label,
      time: `${pad(local.hour)}:${pad(local.minute)}`,
      abbreviation: globalSessionAbbreviation(instant, timeZone),
      dayOffset: referenceDate.until(localDate, { largestUnit: 'day' }).days,
    };
  });
}

export function nextWeekdayDateInZone(
  timeZone: string,
  weekday = 5,
  now: InstantInput = Temporal.Now.instant(),
): string {
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    throw new RangeError('Weekday must be an ISO weekday between 1 and 7.');
  }
  if (!isValidTimeZone(timeZone)) {
    throw new RangeError(`Invalid IANA timezone "${timeZone}".`);
  }

  const today = coerceInstant(now).toZonedDateTimeISO(timeZone);
  const daysUntilWeekday = (weekday - today.dayOfWeek + 7) % 7;
  return today.toPlainDate().add({ days: daysUntilWeekday }).toString();
}

export function upcomingSessionTime(
  time: string,
  timezone = VGZT_TIME_ZONE,
): ScheduledEventTime {
  return {
    date: nextWeekdayDateInZone(timezone),
    time,
    timezone,
  };
}

function labels(
  instant: Temporal.Instant,
  parts: ZonedEventParts,
  locale: string,
): { dateLabel: string; timeLabel: string } {
  const date = new Date(Number(instant.epochMilliseconds));
  return {
    dateLabel: new Intl.DateTimeFormat(locale, {
      timeZone: parts.timeZone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date),
    timeLabel: `${parts.time} ${parts.abbreviation}`,
  };
}

export function formatEventTime(
  event: ScheduledEventTime,
  viewerTimeZone: string,
  locale = 'en-GB',
): FormattedEventTime {
  const instant = canonicalEventInstant(event);
  const local = eventPartsInZone(event, viewerTimeZone, locale);
  const reference = eventPartsInZone(event, event.timezone, locale);
  return {
    local: { ...local, ...labels(instant, local, locale) },
    reference: { ...reference, ...labels(instant, reference, locale) },
  };
}

export function chooseTimeZone(
  manualOverride: string | null | undefined,
  detectedTimeZone: string | null | undefined,
): string {
  if (manualOverride && isValidTimeZone(manualOverride)) return manualOverride;
  if (detectedTimeZone && isValidTimeZone(detectedTimeZone))
    return detectedTimeZone;
  return 'UTC';
}

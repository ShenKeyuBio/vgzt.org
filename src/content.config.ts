import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const wallTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const orcidPattern = /^https:\/\/orcid\.org\/\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined)
    return false;

  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function isIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(0);
    return value === 'UTC' || value.includes('/');
  } catch {
    return false;
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return value === value.trim() && new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

const id = z
  .string()
  .min(3)
  .max(80)
  .regex(
    slugPattern,
    'Use lowercase letters, numbers, and single hyphens only.',
  );
const dateOnly = z
  .string()
  .refine(isCalendarDate, 'Use a real calendar date in YYYY-MM-DD format.');
const wallTime = z.string().regex(wallTimePattern, 'Use 24-hour HH:mm format.');
const timeZone = z
  .string()
  .refine(isIanaTimeZone, 'Use an IANA timezone such as America/New_York.');
const nullableHttpsUrl = z
  .string()
  .refine(isHttpsUrl, 'Use a complete https:// URL.')
  .nullable()
  .default(null);
const nullableShortText = (maximum: number) =>
  z.string().trim().min(1).max(maximum).nullable().default(null);

const people = defineCollection({
  loader: glob({ base: './src/content/people', pattern: '**/*.{yml,yaml}' }),
  schema: ({ image }) =>
    z
      .object({
        id,
        name: z.string().trim().min(1).max(100),
        preferredName: nullableShortText(100),
        currentAffiliation: nullableShortText(200),
        country: nullableShortText(100),
        title: nullableShortText(160),
        portrait: image()
          .refine(
            (value) =>
              typeof value === 'string'
                ? /\.(?:png|jpe?g|webp)$/i.test(value)
                : /\.(?:png|jpe?g|webp)$/i.test(value.src) ||
                  ['png', 'jpg', 'jpeg', 'webp'].includes(value.format),
            'Use a PNG, JPEG, or WebP portrait.',
          )
          .nullable()
          .default(null),
        portraitAlt: nullableShortText(180),
        website: nullableHttpsUrl,
        orcid: z
          .string()
          .regex(orcidPattern, 'Use a canonical https://orcid.org/... URL.')
          .nullable()
          .default(null),
        bluesky: nullableHttpsUrl,
        linkedin: nullableHttpsUrl,
        bio: nullableShortText(2_000),
        historicalSeasons: z
          .array(z.number().int().min(1).max(99))
          .max(20)
          .default([]),
        verificationStatus: z
          .enum(['verified', 'needs-review'])
          .default('needs-review'),
        sourceUrl: nullableHttpsUrl,
        sourceNote: nullableShortText(500),
        status: z.enum(['draft', 'published']).default('draft'),
      })
      .superRefine((person, context) => {
        if (person.portrait !== null && person.portraitAlt === null) {
          context.addIssue({
            code: 'custom',
            path: ['portraitAlt'],
            message:
              'Portrait alt text is required when a portrait is supplied.',
          });
        }

        if (
          new Set(person.historicalSeasons).size !==
          person.historicalSeasons.length
        ) {
          context.addIssue({
            code: 'custom',
            path: ['historicalSeasons'],
            message: 'Historical season numbers must be unique.',
          });
        }
      }),
});

const seasons = defineCollection({
  loader: glob({ base: './src/content/seasons', pattern: '**/*.{yml,yaml}' }),
  schema: z
    .object({
      id,
      season: z.number().int().min(1).max(99),
      label: z.string().trim().min(1).max(80),
      start: dateOnly,
      end: dateOnly,
      timezone: timeZone,
      status: z.enum(['draft', 'published', 'archived']).default('draft'),
      description: nullableShortText(2_000),
      organizers: z.array(id).max(30).default([]),
    })
    .superRefine((season, context) => {
      if (season.start > season.end) {
        context.addIssue({
          code: 'custom',
          path: ['end'],
          message: 'Season end must be on or after its start date.',
        });
      }

      if (new Set(season.organizers).size !== season.organizers.length) {
        context.addIssue({
          code: 'custom',
          path: ['organizers'],
          message: 'Organizer references must be unique.',
        });
      }

      if (season.status === 'published' && season.organizers.length === 0) {
        context.addIssue({
          code: 'custom',
          path: ['organizers'],
          message: 'A published season must have at least one organizer.',
        });
      }
    }),
});

const eventSpeaker = z.object({
  person: id,
  role: z
    .enum(['pi', 'student', 'postdoc', 'keynote', 'speaker'])
    .nullable()
    .default(null),
  talkTitle: nullableShortText(300),
  affiliationOverride: nullableShortText(200),
});

const events = defineCollection({
  loader: glob({ base: './src/content/events', pattern: '**/{*,.*}.yml' }),
  schema: ({ image }) =>
    z
      .object({
        id,
        season: id,
        status: z.enum(['draft', 'published', 'cancelled']).default('draft'),
        date: dateOnly.nullable().default(null),
        time: wallTime.nullable().default(null),
        timezone: timeZone,
        durationMinutes: z.number().int().min(15).max(180).default(60),
        sessionType: id,
        timeSlot: z.enum(['eastern', 'western', 'alternative', 'custom']),
        speakers: z.array(eventSpeaker).max(2).default([]),
        poster: image()
          .refine(
            (value) =>
              typeof value === 'string'
                ? /\.(?:png|jpe?g|webp)$/i.test(value)
                : ['png', 'jpg', 'jpeg', 'webp'].includes(value.format),
            'Use a PNG, JPEG, or WebP poster.',
          )
          .nullable()
          .default(null),
        posterAlt: nullableShortText(300),
        recordingUrl: nullableHttpsUrl,
        recordingLabel: nullableShortText(100),
        description: nullableShortText(2_000),
        featured: z.boolean().default(false),
      })
      .superRefine((event, context) => {
        if (
          event.status !== 'draft' &&
          (event.date === null || event.time === null)
        ) {
          context.addIssue({
            code: 'custom',
            path: event.date === null ? ['date'] : ['time'],
            message:
              'Published and cancelled events require both a date and time.',
          });
        }

        const people = event.speakers.map((speaker) => speaker.person);
        if (new Set(people).size !== people.length) {
          context.addIssue({
            code: 'custom',
            path: ['speakers'],
            message: 'A person may only appear once in an event.',
          });
        }

        if (event.poster !== null && event.posterAlt === null) {
          context.addIssue({
            code: 'custom',
            path: ['posterAlt'],
            message: 'Poster alt text is required when a poster is supplied.',
          });
        }

        if (event.recordingLabel !== null && event.recordingUrl === null) {
          context.addIssue({
            code: 'custom',
            path: ['recordingLabel'],
            message:
              'A recording label cannot be supplied without a recording URL.',
          });
        }
      }),
});

const opportunities = defineCollection({
  loader: glob({
    base: './src/content/opportunities',
    pattern: '**/{*,.*}.yml',
  }),
  schema: z
    .object({
      id,
      title: z.string().trim().min(3).max(160),
      type: z.enum(['job', 'phd', 'postdoc', 'funding', 'event', 'community']),
      institution: z.string().trim().min(1).max(160),
      location: z.string().trim().min(1).max(160),
      summary: z.string().trim().min(20).max(500),
      postedAt: dateOnly,
      deadline: dateOnly.nullable().default(null),
      expiresAt: dateOnly.nullable().default(null),
      externalUrl: z
        .string()
        .refine(isHttpsUrl, 'Use a complete https:// URL.'),
      featured: z.boolean().default(false),
      status: z.enum(['draft', 'published', 'archived']).default('draft'),
    })
    .superRefine((opportunity, context) => {
      if (
        opportunity.deadline !== null &&
        opportunity.deadline < opportunity.postedAt
      ) {
        context.addIssue({
          code: 'custom',
          path: ['deadline'],
          message: 'Deadline cannot be before the posting date.',
        });
      }

      if (
        opportunity.expiresAt !== null &&
        opportunity.expiresAt < opportunity.postedAt
      ) {
        context.addIssue({
          code: 'custom',
          path: ['expiresAt'],
          message: 'Expiry cannot be before the posting date.',
        });
      }
    }),
});

export const collections = { events, opportunities, people, seasons };

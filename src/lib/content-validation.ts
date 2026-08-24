const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRODUCTION_CONTACT_ENDPOINT = 'https://api.vgzt.org/contact';

export interface SourcedRecord {
  __source?: string;
}

export interface PersonRecord extends SourcedRecord {
  id: string;
  name: string;
  status: 'draft' | 'published';
  portrait: string | null;
  portraitAlt: string | null;
  website: string | null;
  orcid: string | null;
  bluesky: string | null;
  linkedin: string | null;
}

export interface SeasonRecord extends SourcedRecord {
  id: string;
  season: number;
  label: string;
  start: string;
  end: string;
  timezone: string;
  status: 'draft' | 'published' | 'archived';
  organizers: string[];
  speakerPreview: SpeakerPreviewRecord | null;
  awards: SeasonAwardsRecord | null;
}

export interface SpeakerPreviewPersonRecord {
  name: string;
  affiliation: string;
}

export interface SpeakerPreviewRecord {
  enabled: boolean;
  disclaimer: string;
  speakers: SpeakerPreviewPersonRecord[];
}

export interface EarlyCareerAwardCategoryRecord {
  id: 'student-pre-doctoral' | 'research-staff';
  label: string;
  description: string;
}

export interface EarlyCareerTalkAwardRecord {
  enabled: boolean;
  eyebrow: string;
  title: string;
  intro: string;
  categories: EarlyCareerAwardCategoryRecord[];
  sponsorNote: string | null;
}

export interface AttendanceAwardSlotRecord {
  id: 'eastern' | 'western' | 'alternative';
  label: string;
  description: string;
  conditional: boolean;
}

export interface AttendanceAwardRecord {
  enabled: boolean;
  eyebrow: string;
  title: string;
  intro: string;
  slots: AttendanceAwardSlotRecord[];
  sponsorNote: string | null;
}

export interface SeasonAwardsRecord {
  earlyCareerTalk: EarlyCareerTalkAwardRecord | null;
  attendance: AttendanceAwardRecord | null;
}

export interface SpeakerRecord {
  person: string;
  role: 'pi' | 'student' | 'postdoc' | 'keynote' | 'speaker' | null;
  talkTitle: string | null;
  affiliationOverride: string | null;
}

export interface EventRecord extends SourcedRecord {
  id: string;
  season: string;
  status: 'draft' | 'published' | 'cancelled';
  date: string | null;
  time: string | null;
  timezone: string;
  durationMinutes: number;
  sessionType: string;
  timeSlot: 'eastern' | 'western' | 'alternative' | 'custom';
  speakers: SpeakerRecord[];
  poster: string | null;
  posterAlt: string | null;
  recordingUrl: string | null;
}

export interface OpportunityRecord extends SourcedRecord {
  id: string;
  title: string;
  type: 'job' | 'phd' | 'postdoc' | 'funding' | 'event' | 'community';
  institution: string;
  location: string;
  summary: string;
  postedAt: string;
  deadline: string | null;
  expiresAt: string | null;
  externalUrl: string;
  featured: boolean;
  status: 'draft' | 'published' | 'archived';
}

export interface SessionTypeRecord {
  id: string;
  label: string;
  speakerCount: number;
  totalDurationMinutes: number;
  presentationMinutesPerSpeaker: number;
  qaMinutesPerSpeaker: number;
  description: string;
}

export interface TimeSlotRecord {
  id: string;
  label: string;
  time: string;
}

export interface AbstractCallRecord {
  state: 'opening-soon' | 'open' | 'closed';
  season: string;
  audience: string;
  submissionTimeline: { label: string; date: string }[];
  rollingLabel: string;
  formUrl: string | null;
  fallbackFormUrl: string | null;
  preferredTimeSlots: string[];
  whatToSubmit: string[];
  faq: { question: string; answer: string }[];
}

export interface SiteRecord {
  site: string;
  name: string;
  shortName: string;
  description: string;
  currentSeason: string;
  publicEmail: string;
  masterLogo: string | null;
  contactEndpoint: string | null;
  turnstileSiteKey: string | null;
}

export interface SocialRecord {
  newsletterUrl: string | null;
  newsletterEmbedScriptUrl: string | null;
  newsletterFormId: string | null;
  slackInviteUrl: string | null;
  linkedinUrl: string | null;
  blueskyUrl: string | null;
  xUrl: string | null;
  instagramUrl: string | null;
}

export interface PendingRecord {
  key: string;
  label: string;
  type: 'image' | 'url' | 'text' | 'date' | 'configuration';
  intendedLocation: string;
  status: 'pending' | 'resolved';
  requiredForLaunch: boolean;
  replaceVia: string;
  resolvedAt: string | null;
  notes: string | null;
}

export interface ContentGraph {
  people: PersonRecord[];
  seasons: SeasonRecord[];
  events: EventRecord[];
  opportunities: OpportunityRecord[];
  sessionTypes: SessionTypeRecord[];
  timeSlots: TimeSlotRecord[];
  abstractCall: AbstractCallRecord;
  site: SiteRecord;
  social: SocialRecord;
  pending: PendingRecord[];
}

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface ValidationOptions {
  launch?: boolean;
  assetExists?: (sourceFile: string, assetReference: string) => boolean;
}

function add(
  issues: ValidationIssue[],
  code: string,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function sourceOf(record: SourcedRecord, fallback: string): string {
  return record.__source ?? fallback;
}

function fileStem(source: string): string | null {
  const name = source.split(/[\\/]/).at(-1);
  return name?.replace(/\.(?:ya?ml)$/i, '') ?? null;
}

export function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
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

export function isIanaTimeZone(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(0);
    return value === 'UTC' || value.includes('/');
  } catch {
    return false;
  }
}

export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return value === value.trim() && new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 3 &&
    value.length <= 80 &&
    ID_PATTERN.test(value)
  );
}

function checkIds<T extends SourcedRecord & { id: string }>(
  records: readonly T[],
  collection: string,
  issues: ValidationIssue[],
): Map<string, T> {
  const found = new Map<string, T>();
  records.forEach((record, index) => {
    const source = sourceOf(record, `${collection}[${index}]`);
    if (!isId(record.id)) {
      add(
        issues,
        'invalid_id',
        `${source}:id`,
        'ID must be a stable lowercase hyphenated slug.',
      );
      return;
    }

    const existing = found.get(record.id);
    if (existing) {
      add(
        issues,
        'duplicate_id',
        `${source}:id`,
        `Duplicate ${collection} ID "${record.id}"; first declared in ${sourceOf(existing, collection)}.`,
      );
    } else {
      found.set(record.id, record);
    }

    if (record.__source) {
      const stem = fileStem(record.__source);
      if (stem !== record.id) {
        add(
          issues,
          'filename_id_mismatch',
          `${source}:id`,
          `File name "${stem ?? ''}" must match ID "${record.id}".`,
        );
      }
    }
  });
  return found;
}

function checkNullableUrl(
  issues: ValidationIssue[],
  path: string,
  value: unknown,
): void {
  if (value !== null && !isHttpsUrl(value)) {
    add(
      issues,
      'invalid_url',
      path,
      'URL must be null or a complete https:// URL.',
    );
  }
}

function checkRequiredText(
  issues: ValidationIssue[],
  path: string,
  value: unknown,
  maximum: number,
): void {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > maximum
  ) {
    add(
      issues,
      'invalid_text',
      path,
      `Value must contain 1–${maximum} characters.`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkOptionalText(
  issues: ValidationIssue[],
  path: string,
  value: unknown,
  maximum: number,
): void {
  if (value !== null && value !== undefined) {
    checkRequiredText(issues, path, value, maximum);
  }
}

function validateSpeakerPreview(
  value: unknown,
  source: string,
  issues: ValidationIssue[],
): void {
  if (value === null || value === undefined) return;
  if (!isRecord(value)) {
    add(
      issues,
      'invalid_shape',
      `${source}:speakerPreview`,
      'Speaker preview must be an object or null.',
    );
    return;
  }

  if (typeof value.enabled !== 'boolean') {
    add(
      issues,
      'invalid_configuration',
      `${source}:speakerPreview.enabled`,
      'Speaker preview enabled must be true or false.',
    );
  }
  checkRequiredText(
    issues,
    `${source}:speakerPreview.disclaimer`,
    value.disclaimer,
    1_200,
  );
  if (!Array.isArray(value.speakers)) {
    add(
      issues,
      'invalid_shape',
      `${source}:speakerPreview.speakers`,
      'Speaker preview speakers must be a list.',
    );
    return;
  }

  const names = new Set<string>();
  value.speakers.forEach((speaker, index) => {
    const path = `${source}:speakerPreview.speakers[${index}]`;
    if (!isRecord(speaker)) {
      add(
        issues,
        'invalid_shape',
        path,
        'Each preview speaker must be an object.',
      );
      return;
    }
    checkRequiredText(issues, `${path}.name`, speaker.name, 160);
    checkRequiredText(issues, `${path}.affiliation`, speaker.affiliation, 240);
    if (typeof speaker.name === 'string') {
      const normalized = speaker.name.trim().toLocaleLowerCase('en');
      if (names.has(normalized)) {
        add(
          issues,
          'duplicate_speaker_preview',
          `${path}.name`,
          `Speaker preview name "${speaker.name}" is duplicated case-insensitively.`,
        );
      }
      names.add(normalized);
    }
  });
}

function validateEarlyCareerTalkAward(
  value: unknown,
  source: string,
  issues: ValidationIssue[],
): void {
  const path = `${source}:awards.earlyCareerTalk`;
  if (!isRecord(value)) {
    add(
      issues,
      'invalid_award',
      path,
      'Early Career Talk award must be an object or null.',
    );
    return;
  }
  if (typeof value.enabled !== 'boolean') {
    add(
      issues,
      'invalid_award',
      `${path}.enabled`,
      'Award enabled must be true or false.',
    );
  }
  checkRequiredText(issues, `${path}.eyebrow`, value.eyebrow, 100);
  checkRequiredText(issues, `${path}.title`, value.title, 180);
  checkRequiredText(issues, `${path}.intro`, value.intro, 600);
  checkOptionalText(issues, `${path}.sponsorNote`, value.sponsorNote, 300);
  if (!Array.isArray(value.categories) || value.categories.length !== 2) {
    add(
      issues,
      'invalid_award',
      `${path}.categories`,
      'Early Career Talk awards must define exactly two categories.',
    );
    return;
  }

  const categoryIds = new Set<string>();
  const allowedIds = new Set(['student-pre-doctoral', 'research-staff']);
  value.categories.forEach((category, index) => {
    const categoryPath = `${path}.categories[${index}]`;
    if (!isRecord(category)) {
      add(
        issues,
        'invalid_award',
        categoryPath,
        'Award category must be an object.',
      );
      return;
    }
    if (typeof category.id !== 'string' || !allowedIds.has(category.id)) {
      add(
        issues,
        'invalid_award',
        `${categoryPath}.id`,
        'Award category ID must be student-pre-doctoral or research-staff.',
      );
    }
    if (typeof category.id === 'string') {
      if (categoryIds.has(category.id)) {
        add(
          issues,
          'duplicate_award_category',
          `${categoryPath}.id`,
          `Award category "${category.id}" is duplicated.`,
        );
      }
      categoryIds.add(category.id);
    }
    checkRequiredText(issues, `${categoryPath}.label`, category.label, 120);
    checkRequiredText(
      issues,
      `${categoryPath}.description`,
      category.description,
      500,
    );
  });
}

function validateAttendanceAward(
  value: unknown,
  source: string,
  issues: ValidationIssue[],
): void {
  const path = `${source}:awards.attendance`;
  if (!isRecord(value)) {
    add(
      issues,
      'invalid_award',
      path,
      'Attendance award must be an object or null.',
    );
    return;
  }
  if (typeof value.enabled !== 'boolean') {
    add(
      issues,
      'invalid_award',
      `${path}.enabled`,
      'Award enabled must be true or false.',
    );
  }
  checkRequiredText(issues, `${path}.eyebrow`, value.eyebrow, 100);
  checkRequiredText(issues, `${path}.title`, value.title, 180);
  checkRequiredText(issues, `${path}.intro`, value.intro, 600);
  checkOptionalText(issues, `${path}.sponsorNote`, value.sponsorNote, 300);
  if (
    !Array.isArray(value.slots) ||
    value.slots.length < 2 ||
    value.slots.length > 3
  ) {
    add(
      issues,
      'invalid_award',
      `${path}.slots`,
      'Attendance awards must define two or three slots.',
    );
    return;
  }

  const slotIds = new Set<string>();
  const allowedIds = new Set(['eastern', 'western', 'alternative']);
  value.slots.forEach((slot, index) => {
    const slotPath = `${path}.slots[${index}]`;
    if (!isRecord(slot)) {
      add(
        issues,
        'invalid_award',
        slotPath,
        'Attendance slot must be an object.',
      );
      return;
    }
    if (typeof slot.id !== 'string' || !allowedIds.has(slot.id)) {
      add(
        issues,
        'invalid_award',
        `${slotPath}.id`,
        'Attendance slot ID must be eastern, western, or alternative.',
      );
    }
    if (typeof slot.id === 'string') {
      if (slotIds.has(slot.id)) {
        add(
          issues,
          'duplicate_attendance_slot',
          `${slotPath}.id`,
          `Attendance slot "${slot.id}" is duplicated.`,
        );
      }
      slotIds.add(slot.id);
    }
    checkRequiredText(issues, `${slotPath}.label`, slot.label, 80);
    checkRequiredText(issues, `${slotPath}.description`, slot.description, 500);
    if (typeof slot.conditional !== 'boolean') {
      add(
        issues,
        'invalid_award',
        `${slotPath}.conditional`,
        'Attendance slot conditional must be true or false.',
      );
    }
    if (slot.id === 'alternative' && slot.conditional !== true) {
      add(
        issues,
        'invalid_award',
        `${slotPath}.conditional`,
        'The alternative attendance award must be conditional.',
      );
    }
  });
  if (!slotIds.has('eastern') || !slotIds.has('western')) {
    add(
      issues,
      'invalid_award',
      `${path}.slots`,
      'Attendance awards must include both eastern and western slots.',
    );
  }
}

function validateSeasonAwards(
  value: unknown,
  source: string,
  issues: ValidationIssue[],
): void {
  if (value === null || value === undefined) return;
  if (!isRecord(value)) {
    add(
      issues,
      'invalid_shape',
      `${source}:awards`,
      'Season awards must be an object or null.',
    );
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(value, 'earlyCareerTalk')) {
    add(
      issues,
      'invalid_award',
      `${source}:awards.earlyCareerTalk`,
      'Set earlyCareerTalk to an award object or null.',
    );
  } else if (value.earlyCareerTalk !== null) {
    validateEarlyCareerTalkAward(value.earlyCareerTalk, source, issues);
  }
  if (!Object.prototype.hasOwnProperty.call(value, 'attendance')) {
    add(
      issues,
      'invalid_award',
      `${source}:awards.attendance`,
      'Set attendance to an award object or null.',
    );
  } else if (value.attendance !== null) {
    validateAttendanceAward(value.attendance, source, issues);
  }
}

function validateSessionDefinitions(
  graph: ContentGraph,
  issues: ValidationIssue[],
): {
  sessionTypes: Map<string, SessionTypeRecord>;
  timeSlots: Map<string, TimeSlotRecord>;
} {
  const sessionTypes = new Map<string, SessionTypeRecord>();
  for (const [index, sessionType] of graph.sessionTypes.entries()) {
    const path = `src/data/session-types.yml:sessionTypes[${index}]`;
    if (!isId(sessionType.id)) {
      add(
        issues,
        'invalid_id',
        `${path}.id`,
        'Session type ID must be a lowercase slug.',
      );
      continue;
    }
    if (sessionTypes.has(sessionType.id)) {
      add(
        issues,
        'duplicate_id',
        `${path}.id`,
        `Duplicate session type "${sessionType.id}".`,
      );
    }
    sessionTypes.set(sessionType.id, sessionType);

    const numbers = [
      sessionType.speakerCount,
      sessionType.totalDurationMinutes,
      sessionType.presentationMinutesPerSpeaker,
      sessionType.qaMinutesPerSpeaker,
    ];
    if (numbers.some((value) => !Number.isInteger(value) || value <= 0)) {
      add(
        issues,
        'invalid_duration',
        path,
        'Session counts and durations must be positive integers.',
      );
    } else if (
      (sessionType.presentationMinutesPerSpeaker +
        sessionType.qaMinutesPerSpeaker) *
        sessionType.speakerCount !==
      sessionType.totalDurationMinutes
    ) {
      add(
        issues,
        'duration_mismatch',
        path,
        'Presentation and Q&A durations multiplied by speaker count must equal total duration.',
      );
    }
  }

  const timeSlots = new Map<string, TimeSlotRecord>();
  for (const [index, timeSlot] of graph.timeSlots.entries()) {
    const path = `src/data/session-types.yml:timeSlots[${index}]`;
    if (!isId(timeSlot.id)) {
      add(
        issues,
        'invalid_id',
        `${path}.id`,
        'Time slot ID must be a lowercase slug.',
      );
      continue;
    }
    if (timeSlots.has(timeSlot.id)) {
      add(
        issues,
        'duplicate_id',
        `${path}.id`,
        `Duplicate time slot "${timeSlot.id}".`,
      );
    }
    timeSlots.set(timeSlot.id, timeSlot);
    if (
      typeof timeSlot.time !== 'string' ||
      !TIME_PATTERN.test(timeSlot.time)
    ) {
      add(
        issues,
        'invalid_time',
        `${path}.time`,
        'Time slot must use 24-hour HH:mm format.',
      );
    }
  }

  return { sessionTypes, timeSlots };
}

export function validateContentGraph(
  graph: ContentGraph,
  options: ValidationOptions = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const people = checkIds(graph.people, 'people', issues);
  const seasons = checkIds(graph.seasons, 'seasons', issues);
  checkIds(graph.events, 'events', issues);
  checkIds(graph.opportunities, 'opportunities', issues);
  const definitions = validateSessionDefinitions(graph, issues);

  for (const [index, person] of graph.people.entries()) {
    const source = sourceOf(person, `people[${index}]`);
    if (typeof person.name !== 'string' || person.name.trim().length === 0) {
      add(issues, 'invalid_name', `${source}:name`, 'Person name is required.');
    }
    if (!['draft', 'published'].includes(person.status)) {
      add(
        issues,
        'invalid_status',
        `${source}:status`,
        'Person status must be draft or published.',
      );
    }
    checkNullableUrl(issues, `${source}:website`, person.website);
    checkNullableUrl(issues, `${source}:orcid`, person.orcid);
    checkNullableUrl(issues, `${source}:bluesky`, person.bluesky);
    checkNullableUrl(issues, `${source}:linkedin`, person.linkedin);
    if (person.portrait !== null) {
      if (
        typeof person.portraitAlt !== 'string' ||
        person.portraitAlt.trim().length === 0
      ) {
        add(
          issues,
          'missing_alt',
          `${source}:portraitAlt`,
          'Portrait alt text is required.',
        );
      }
      if (
        options.assetExists &&
        !options.assetExists(source, person.portrait)
      ) {
        add(
          issues,
          'missing_asset',
          `${source}:portrait`,
          `Portrait asset "${person.portrait}" does not exist.`,
        );
      }
    }
  }

  for (const [index, season] of graph.seasons.entries()) {
    const source = sourceOf(season, `seasons[${index}]`);
    validateSpeakerPreview(season.speakerPreview, source, issues);
    validateSeasonAwards(season.awards, source, issues);
    if (!isDateOnly(season.start)) {
      add(
        issues,
        'invalid_date',
        `${source}:start`,
        'Season start must be a real YYYY-MM-DD date.',
      );
    }
    if (!isDateOnly(season.end)) {
      add(
        issues,
        'invalid_date',
        `${source}:end`,
        'Season end must be a real YYYY-MM-DD date.',
      );
    }
    if (
      isDateOnly(season.start) &&
      isDateOnly(season.end) &&
      season.start > season.end
    ) {
      add(
        issues,
        'date_order',
        `${source}:end`,
        'Season end cannot precede its start.',
      );
    }
    if (!isIanaTimeZone(season.timezone)) {
      add(
        issues,
        'invalid_timezone',
        `${source}:timezone`,
        'Season timezone must be an IANA timezone.',
      );
    }
    if (!Array.isArray(season.organizers)) {
      add(
        issues,
        'invalid_shape',
        `${source}:organizers`,
        'Organizers must be a list of person IDs.',
      );
      continue;
    }
    if (new Set(season.organizers).size !== season.organizers.length) {
      add(
        issues,
        'duplicate_reference',
        `${source}:organizers`,
        'Organizer references must be unique.',
      );
    }
    for (const [organizerIndex, organizer] of season.organizers.entries()) {
      const person = people.get(organizer);
      if (!person) {
        add(
          issues,
          'invalid_reference',
          `${source}:organizers[${organizerIndex}]`,
          `Unknown person reference "${organizer}".`,
        );
      } else if (
        season.status === 'published' &&
        person.status !== 'published'
      ) {
        add(
          issues,
          'draft_reference',
          `${source}:organizers[${organizerIndex}]`,
          `Published season "${season.id}" cannot reference draft person "${organizer}".`,
        );
      }
    }
  }

  if (!seasons.has(graph.site.currentSeason)) {
    add(
      issues,
      'invalid_reference',
      'src/data/site.yml:currentSeason',
      `Unknown season reference "${graph.site.currentSeason}".`,
    );
  }
  if (!isHttpsUrl(graph.site.site)) {
    add(
      issues,
      'invalid_url',
      'src/data/site.yml:site',
      'Site must be a complete https:// URL.',
    );
  }
  checkRequiredText(issues, 'src/data/site.yml:name', graph.site.name, 120);
  checkRequiredText(
    issues,
    'src/data/site.yml:shortName',
    graph.site.shortName,
    20,
  );
  checkRequiredText(
    issues,
    'src/data/site.yml:description',
    graph.site.description,
    300,
  );
  if (
    typeof graph.site.publicEmail !== 'string' ||
    !EMAIL_PATTERN.test(graph.site.publicEmail) ||
    /[\r\n]/.test(graph.site.publicEmail)
  ) {
    add(
      issues,
      'invalid_email',
      'src/data/site.yml:publicEmail',
      'Public email is invalid.',
    );
  }
  if (
    graph.site.masterLogo !== null &&
    (typeof graph.site.masterLogo !== 'string' ||
      !/^\/brand\/[a-z0-9][a-z0-9._/-]*\.(?:png|jpe?g|webp)$/i.test(
        graph.site.masterLogo,
      ) ||
      graph.site.masterLogo.includes('..'))
  ) {
    add(
      issues,
      'invalid_asset_path',
      'src/data/site.yml:masterLogo',
      'Master logo must be null or a safe PNG, JPEG, or WebP file under /brand/.',
    );
  }
  if (
    graph.site.contactEndpoint !== null &&
    graph.site.contactEndpoint !== PRODUCTION_CONTACT_ENDPOINT
  ) {
    add(
      issues,
      'invalid_configuration',
      'src/data/site.yml:contactEndpoint',
      `Contact endpoint must be null or exactly ${PRODUCTION_CONTACT_ENDPOINT}.`,
    );
  }
  if (
    graph.site.turnstileSiteKey !== null &&
    (typeof graph.site.turnstileSiteKey !== 'string' ||
      graph.site.turnstileSiteKey.trim().length === 0 ||
      graph.site.turnstileSiteKey.length > 200)
  ) {
    add(
      issues,
      'invalid_configuration',
      'src/data/site.yml:turnstileSiteKey',
      'Turnstile site key must be null or a non-empty public key.',
    );
  }
  for (const key of [
    'newsletterUrl',
    'newsletterEmbedScriptUrl',
    'slackInviteUrl',
    'linkedinUrl',
    'blueskyUrl',
    'xUrl',
    'instagramUrl',
  ] as const) {
    checkNullableUrl(issues, `src/data/social.yml:${key}`, graph.social[key]);
  }
  if (
    graph.social.newsletterFormId !== null &&
    (typeof graph.social.newsletterFormId !== 'string' ||
      !/^[a-z0-9-]{1,100}$/iu.test(graph.social.newsletterFormId))
  ) {
    add(
      issues,
      'invalid_configuration',
      'src/data/social.yml:newsletterFormId',
      'Newsletter form ID must be null or a short provider form identifier.',
    );
  }

  for (const [index, event] of graph.events.entries()) {
    const source = sourceOf(event, `events[${index}]`);
    const season = seasons.get(event.season);
    if (!season) {
      add(
        issues,
        'invalid_reference',
        `${source}:season`,
        `Unknown season reference "${event.season}".`,
      );
    }
    const sessionType = definitions.sessionTypes.get(event.sessionType);
    if (!sessionType) {
      add(
        issues,
        'invalid_reference',
        `${source}:sessionType`,
        `Unknown session type "${event.sessionType}".`,
      );
    }
    const timeSlot =
      event.timeSlot === 'custom'
        ? null
        : definitions.timeSlots.get(event.timeSlot);
    if (event.timeSlot !== 'custom' && !timeSlot) {
      add(
        issues,
        'invalid_reference',
        `${source}:timeSlot`,
        `Unknown time slot "${event.timeSlot}".`,
      );
    }
    if (!isIanaTimeZone(event.timezone)) {
      add(
        issues,
        'invalid_timezone',
        `${source}:timezone`,
        'Event timezone must be an IANA timezone.',
      );
    }
    if (
      !Number.isInteger(event.durationMinutes) ||
      event.durationMinutes < 15 ||
      event.durationMinutes > 180
    ) {
      add(
        issues,
        'invalid_duration',
        `${source}:durationMinutes`,
        'Duration must be 15–180 minutes.',
      );
    }
    if (event.date !== null && !isDateOnly(event.date)) {
      add(
        issues,
        'invalid_date',
        `${source}:date`,
        'Event date must be null or a real YYYY-MM-DD date.',
      );
    }
    if (event.time !== null && !TIME_PATTERN.test(event.time)) {
      add(
        issues,
        'invalid_time',
        `${source}:time`,
        'Event time must be null or 24-hour HH:mm.',
      );
    }
    if (
      event.status !== 'draft' &&
      (event.date === null || event.time === null)
    ) {
      add(
        issues,
        'missing_schedule',
        source,
        'Published and cancelled events require date and time.',
      );
    }
    if (season) {
      if (event.timezone !== season.timezone) {
        add(
          issues,
          'timezone_mismatch',
          `${source}:timezone`,
          `Event timezone must match ${season.id} (${season.timezone}).`,
        );
      }
      if (
        event.date !== null &&
        isDateOnly(event.date) &&
        (event.date < season.start || event.date > season.end)
      ) {
        add(
          issues,
          'outside_season',
          `${source}:date`,
          `Event date must fall between ${season.start} and ${season.end}.`,
        );
      }
    }
    if (timeSlot && event.time !== null && event.time !== timeSlot.time) {
      add(
        issues,
        'time_slot_mismatch',
        `${source}:time`,
        `${event.timeSlot} events must use ${timeSlot.time}; select custom for another time.`,
      );
    }

    if (!Array.isArray(event.speakers)) {
      add(
        issues,
        'invalid_shape',
        `${source}:speakers`,
        'Speakers must be a list.',
      );
      continue;
    }
    const speakerIds = event.speakers.map((speaker) => speaker.person);
    if (new Set(speakerIds).size !== speakerIds.length) {
      add(
        issues,
        'duplicate_reference',
        `${source}:speakers`,
        'Speaker references must be unique.',
      );
    }
    for (const [speakerIndex, speaker] of event.speakers.entries()) {
      const person = people.get(speaker.person);
      if (!person) {
        add(
          issues,
          'invalid_reference',
          `${source}:speakers[${speakerIndex}].person`,
          `Unknown person reference "${speaker.person}".`,
        );
      } else if (
        event.status === 'published' &&
        person.status !== 'published' &&
        season?.status !== 'archived'
      ) {
        add(
          issues,
          'draft_reference',
          `${source}:speakers[${speakerIndex}].person`,
          `Published event "${event.id}" cannot reference draft person "${speaker.person}".`,
        );
      }
    }
    if (event.status === 'published' && sessionType) {
      if (event.speakers.length !== sessionType.speakerCount) {
        add(
          issues,
          'speaker_count',
          `${source}:speakers`,
          `${sessionType.label} requires exactly ${sessionType.speakerCount} speaker(s).`,
        );
      }
      if (
        event.sessionType === 'two-speaker' &&
        season?.status !== 'archived'
      ) {
        const piCount = event.speakers.filter(
          ({ role }) => role === 'pi',
        ).length;
        const ecrCount = event.speakers.filter(
          ({ role }) => role === 'student' || role === 'postdoc',
        ).length;
        if (piCount !== 1 || ecrCount !== 1) {
          add(
            issues,
            'speaker_roles',
            `${source}:speakers`,
            'A published two-speaker session requires one PI and one student or postdoc.',
          );
        }
      }
    }
    if (event.poster !== null) {
      if (
        typeof event.posterAlt !== 'string' ||
        event.posterAlt.trim().length === 0
      ) {
        add(
          issues,
          'missing_alt',
          `${source}:posterAlt`,
          'Poster alt text is required.',
        );
      }
      if (options.assetExists && !options.assetExists(source, event.poster)) {
        add(
          issues,
          'missing_asset',
          `${source}:poster`,
          `Poster asset "${event.poster}" does not exist.`,
        );
      }
    }
    checkNullableUrl(issues, `${source}:recordingUrl`, event.recordingUrl);
  }

  for (const [index, opportunity] of graph.opportunities.entries()) {
    const source = sourceOf(opportunity, `opportunities[${index}]`);
    if (!isDateOnly(opportunity.postedAt)) {
      add(
        issues,
        'invalid_date',
        `${source}:postedAt`,
        'Posting date must be a real YYYY-MM-DD date.',
      );
    }
    if (opportunity.deadline !== null && !isDateOnly(opportunity.deadline)) {
      add(
        issues,
        'invalid_date',
        `${source}:deadline`,
        'Deadline must be null or YYYY-MM-DD.',
      );
    }
    if (opportunity.expiresAt !== null && !isDateOnly(opportunity.expiresAt)) {
      add(
        issues,
        'invalid_date',
        `${source}:expiresAt`,
        'Expiry must be null or YYYY-MM-DD.',
      );
    }
    if (
      isDateOnly(opportunity.postedAt) &&
      opportunity.deadline !== null &&
      isDateOnly(opportunity.deadline) &&
      opportunity.deadline < opportunity.postedAt
    ) {
      add(
        issues,
        'date_order',
        `${source}:deadline`,
        'Deadline cannot precede posting date.',
      );
    }
    if (
      isDateOnly(opportunity.postedAt) &&
      opportunity.expiresAt !== null &&
      isDateOnly(opportunity.expiresAt) &&
      opportunity.expiresAt < opportunity.postedAt
    ) {
      add(
        issues,
        'date_order',
        `${source}:expiresAt`,
        'Expiry cannot precede posting date.',
      );
    }
    if (!isHttpsUrl(opportunity.externalUrl)) {
      add(
        issues,
        'invalid_url',
        `${source}:externalUrl`,
        'External URL must use https://.',
      );
    }
  }

  if (!seasons.has(graph.abstractCall.season)) {
    add(
      issues,
      'invalid_reference',
      'src/data/abstract-call.yml:season',
      `Unknown season reference "${graph.abstractCall.season}".`,
    );
  }
  if (!['opening-soon', 'open', 'closed'].includes(graph.abstractCall.state)) {
    add(
      issues,
      'invalid_configuration',
      'src/data/abstract-call.yml:state',
      'State must be opening-soon, open, or closed.',
    );
  }
  checkRequiredText(
    issues,
    'src/data/abstract-call.yml:audience',
    graph.abstractCall.audience,
    300,
  );
  checkNullableUrl(
    issues,
    'src/data/abstract-call.yml:formUrl',
    graph.abstractCall.formUrl,
  );
  checkNullableUrl(
    issues,
    'src/data/abstract-call.yml:fallbackFormUrl',
    graph.abstractCall.fallbackFormUrl,
  );
  if (!Array.isArray(graph.abstractCall.submissionTimeline)) {
    add(
      issues,
      'invalid_shape',
      'src/data/abstract-call.yml:submissionTimeline',
      'Submission timeline must be a list.',
    );
  } else {
    for (const [
      index,
      milestone,
    ] of graph.abstractCall.submissionTimeline.entries()) {
      checkRequiredText(
        issues,
        `src/data/abstract-call.yml:submissionTimeline[${index}].label`,
        milestone?.label,
        120,
      );
      if (!isDateOnly(milestone?.date)) {
        add(
          issues,
          'invalid_date',
          `src/data/abstract-call.yml:submissionTimeline[${index}].date`,
          'Use YYYY-MM-DD.',
        );
      }
    }
  }
  checkRequiredText(
    issues,
    'src/data/abstract-call.yml:rollingLabel',
    graph.abstractCall.rollingLabel,
    120,
  );
  if (!Array.isArray(graph.abstractCall.preferredTimeSlots)) {
    add(
      issues,
      'invalid_shape',
      'src/data/abstract-call.yml:preferredTimeSlots',
      'Preferred time slots must be a list.',
    );
  } else {
    for (const [
      index,
      slot,
    ] of graph.abstractCall.preferredTimeSlots.entries()) {
      if (!definitions.timeSlots.has(slot)) {
        add(
          issues,
          'invalid_reference',
          `src/data/abstract-call.yml:preferredTimeSlots[${index}]`,
          `Unknown time slot "${slot}".`,
        );
      }
    }
    if (
      new Set(graph.abstractCall.preferredTimeSlots).size !==
      graph.abstractCall.preferredTimeSlots.length
    ) {
      add(
        issues,
        'duplicate_reference',
        'src/data/abstract-call.yml:preferredTimeSlots',
        'Preferred time slots must be unique.',
      );
    }
  }
  if (!Array.isArray(graph.abstractCall.whatToSubmit)) {
    add(
      issues,
      'invalid_shape',
      'src/data/abstract-call.yml:whatToSubmit',
      'Submission requirements must be a list.',
    );
  } else {
    graph.abstractCall.whatToSubmit.forEach((item, index) =>
      checkRequiredText(
        issues,
        `src/data/abstract-call.yml:whatToSubmit[${index}]`,
        item,
        500,
      ),
    );
  }
  if (!Array.isArray(graph.abstractCall.faq)) {
    add(
      issues,
      'invalid_shape',
      'src/data/abstract-call.yml:faq',
      'FAQ must be a list.',
    );
  } else {
    const questions = new Set<string>();
    graph.abstractCall.faq.forEach((item, index) => {
      checkRequiredText(
        issues,
        `src/data/abstract-call.yml:faq[${index}].question`,
        item?.question,
        300,
      );
      checkRequiredText(
        issues,
        `src/data/abstract-call.yml:faq[${index}].answer`,
        item?.answer,
        2_000,
      );
      if (typeof item?.question === 'string') {
        const normalized = item.question.trim().toLocaleLowerCase('en');
        if (questions.has(normalized)) {
          add(
            issues,
            'duplicate_faq',
            `src/data/abstract-call.yml:faq[${index}].question`,
            'FAQ questions must be unique.',
          );
        }
        questions.add(normalized);
      }
    });
  }

  const pendingKeys = new Set<string>();
  for (const [index, pending] of graph.pending.entries()) {
    const path = `src/data/pending-content.yml:pending[${index}]`;
    if (!pending || typeof pending !== 'object') {
      add(
        issues,
        'invalid_shape',
        path,
        'Each pending-content entry must be an object.',
      );
      continue;
    }
    if (!pending.key || pendingKeys.has(pending.key)) {
      add(
        issues,
        'duplicate_pending_key',
        `${path}.key`,
        'Pending-content keys must be non-empty and unique.',
      );
    }
    pendingKeys.add(pending.key);
    if (
      !['image', 'url', 'text', 'date', 'configuration'].includes(pending.type)
    ) {
      add(
        issues,
        'invalid_pending_type',
        `${path}.type`,
        'Unsupported pending-content type.',
      );
    }
    if (!['pending', 'resolved'].includes(pending.status)) {
      add(
        issues,
        'invalid_status',
        `${path}.status`,
        'Status must be pending or resolved.',
      );
    }
    if (typeof pending.requiredForLaunch !== 'boolean') {
      add(
        issues,
        'invalid_configuration',
        `${path}.requiredForLaunch`,
        'requiredForLaunch must be true or false.',
      );
    }
    checkRequiredText(issues, `${path}.label`, pending.label, 200);
    checkRequiredText(
      issues,
      `${path}.intendedLocation`,
      pending.intendedLocation,
      300,
    );
    checkRequiredText(issues, `${path}.replaceVia`, pending.replaceVia, 500);
    if (pending.status === 'resolved' && !isDateOnly(pending.resolvedAt)) {
      add(
        issues,
        'missing_resolution_date',
        `${path}.resolvedAt`,
        'Resolved items require a YYYY-MM-DD date.',
      );
    }
    if (pending.status === 'pending' && pending.resolvedAt !== null) {
      add(
        issues,
        'invalid_resolution_date',
        `${path}.resolvedAt`,
        'Pending items must have a null resolvedAt.',
      );
    }
    if (
      options.launch &&
      pending.requiredForLaunch &&
      pending.status === 'pending'
    ) {
      add(
        issues,
        'launch_blocker',
        path,
        `${pending.label} is still required for launch.`,
      );
    }
  }

  if (options.launch) {
    const currentSeason = seasons.get(graph.site.currentSeason);
    if (currentSeason && currentSeason.status !== 'published') {
      add(
        issues,
        'launch_blocker',
        'src/data/site.yml:currentSeason',
        'The current season must be published for launch.',
      );
    }
    if (
      graph.abstractCall.state === 'open' &&
      graph.abstractCall.formUrl === null
    ) {
      add(
        issues,
        'launch_blocker',
        'src/data/abstract-call.yml:formUrl',
        'An open abstract call requires a submission URL for launch.',
      );
    }
  }

  return issues;
}

import {
  CATEGORY_LABELS,
  type ContactCategory,
  type ContactValidationResult,
  type ValidationFailure,
} from './contact';
import type { JoinValidationFailure, JoinValidationResult } from './join';

const CONTACT_EXPECTED_KEYS = new Set([
  'name',
  'email',
  'category',
  'message',
  'privacyAccepted',
  'website',
  'turnstileToken',
]);

const JOIN_EXPECTED_KEYS = new Set([
  'email',
  'joinSlack',
  'joinMailingList',
  'website',
  'turnstileToken',
]);

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u;
const SINGLE_LINE_CONTROL_PATTERN = /[\u0000-\u001f\u007f]/u;
const MESSAGE_CONTROL_PATTERN =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function codePointLength(value: string): number {
  return Array.from(value).length;
}

function normalizeSingleLine(value: string): string {
  return value.normalize('NFC').trim();
}

function normalizeMessage(value: string): string {
  return value.replace(/\r\n?/gu, '\n').normalize('NFC').trim();
}

function isCategory(value: unknown): value is ContactCategory {
  return typeof value === 'string' && Object.hasOwn(CATEGORY_LABELS, value);
}

function failure(fields: Record<string, string>): ValidationFailure {
  return { ok: false, fields };
}

function joinFailure(fields: Record<string, string>): JoinValidationFailure {
  return { ok: false, fields };
}

function validateSingleLine(
  value: unknown,
  maxCodePoints: number,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeSingleLine(value);
  return normalized.length > 0 &&
    codePointLength(normalized) <= maxCodePoints &&
    !SINGLE_LINE_CONTROL_PATTERN.test(normalized)
    ? normalized
    : null;
}

function validateEmail(value: unknown): string | null {
  const normalized = validateSingleLine(value, 254);
  return normalized !== null && EMAIL_PATTERN.test(normalized)
    ? normalized
    : null;
}

export function isHoneypotTriggered(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    typeof value.website === 'string' &&
    value.website.trim().length > 0
  );
}

export function normalizeEmailForRateLimit(email: string): string {
  return normalizeSingleLine(email).toLocaleLowerCase('en-US');
}

export function validateContactPayload(
  value: unknown,
): ContactValidationResult {
  if (!isPlainObject(value)) {
    return failure({ form: 'Submit the contact form as a JSON object.' });
  }

  const fields: Record<string, string> = {};
  const unknownKeys = Object.keys(value).filter(
    (key) => !CONTACT_EXPECTED_KEYS.has(key),
  );
  if (unknownKeys.length > 0) {
    fields.form = 'The form contains unsupported fields.';
  }

  const name =
    typeof value.name === 'string' ? normalizeSingleLine(value.name) : '';
  if (
    name.length === 0 ||
    codePointLength(name) > 100 ||
    SINGLE_LINE_CONTROL_PATTERN.test(name)
  ) {
    fields.name = 'Enter a name between 1 and 100 characters.';
  }

  const email =
    typeof value.email === 'string' ? normalizeSingleLine(value.email) : '';
  if (
    email.length === 0 ||
    codePointLength(email) > 254 ||
    SINGLE_LINE_CONTROL_PATTERN.test(email) ||
    !EMAIL_PATTERN.test(email)
  ) {
    fields.email = 'Enter a valid email address.';
  }

  const category = isCategory(value.category) ? value.category : null;
  if (category === null) {
    fields.category = 'Choose a valid message category.';
  }

  const message =
    typeof value.message === 'string' ? normalizeMessage(value.message) : '';
  if (
    codePointLength(message) < 10 ||
    codePointLength(message) > 5_000 ||
    MESSAGE_CONTROL_PATTERN.test(message)
  ) {
    fields.message = 'Enter a message between 10 and 5,000 characters.';
  }

  if (value.privacyAccepted !== true) {
    fields.privacyAccepted = 'Confirm the privacy acknowledgement.';
  }

  if (typeof value.website !== 'string' || value.website.trim().length !== 0) {
    fields.form = 'The form could not be validated.';
  }

  const turnstileToken =
    typeof value.turnstileToken === 'string' ? value.turnstileToken.trim() : '';
  if (turnstileToken.length === 0 || turnstileToken.length > 2_048) {
    fields.verification = 'Complete the verification and try again.';
  }

  if (Object.keys(fields).length > 0 || category === null) {
    return failure(fields);
  }

  return {
    ok: true,
    value: {
      name,
      email,
      category,
      message,
      privacyAccepted: true,
      turnstileToken,
    },
  };
}

export function validateJoinPayload(value: unknown): JoinValidationResult {
  if (!isPlainObject(value)) {
    return joinFailure({ form: 'Submit the join form as a JSON object.' });
  }

  const fields: Record<string, string> = {};
  const unknownKeys = Object.keys(value).filter(
    (key) => !JOIN_EXPECTED_KEYS.has(key),
  );
  if (unknownKeys.length > 0) {
    fields.form = 'The form contains unsupported fields.';
  }

  const email = validateEmail(value.email);
  if (email === null) {
    fields.email = 'Enter a valid email address.';
  }

  const joinSlack =
    typeof value.joinSlack === 'boolean' ? value.joinSlack : null;
  const joinMailingList =
    typeof value.joinMailingList === 'boolean' ? value.joinMailingList : null;
  if (joinSlack === null) {
    fields.joinSlack = 'Choose whether to request VGZT Slack access.';
  }
  if (joinMailingList === null) {
    fields.joinMailingList = 'Choose whether to request the VGZT mailing list.';
  }
  if (joinSlack === false && joinMailingList === false) {
    fields.services = 'Request Slack, the mailing list, or both.';
  }

  if (typeof value.website !== 'string' || value.website.trim().length !== 0) {
    fields.form = 'The form could not be validated.';
  }

  const turnstileToken =
    typeof value.turnstileToken === 'string' ? value.turnstileToken.trim() : '';
  if (turnstileToken.length === 0 || turnstileToken.length > 2_048) {
    fields.verification = 'Complete the verification and try again.';
  }

  if (
    Object.keys(fields).length > 0 ||
    email === null ||
    joinSlack === null ||
    joinMailingList === null
  ) {
    return joinFailure(fields);
  }

  return {
    ok: true,
    value: {
      email,
      joinSlack,
      joinMailingList,
      turnstileToken,
    },
  };
}

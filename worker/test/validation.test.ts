import { describe, expect, it } from 'vitest';

import {
  isHoneypotTriggered,
  validateContactPayload,
  validateJoinPayload,
} from '../src/validation';

function validPayload(
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    name: 'Jane Smith',
    email: 'jane@example.com',
    category: 'general',
    message: 'This is a valid contact message.',
    privacyAccepted: true,
    website: '',
    turnstileToken: 'token',
    ...overrides,
  };
}

function validJoinPayload(
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    email: 'jane@example.com',
    joinSlack: true,
    joinMailingList: true,
    website: '',
    turnstileToken: 'token',
    ...overrides,
  };
}

describe('contact payload validation', () => {
  it('normalizes safe Unicode and CRLF without losing content', () => {
    const result = validateContactPayload(
      validPayload({
        name: '  Jose\u0301  ',
        message: 'Line one.\r\nLine two.',
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('José');
      expect(result.value.message).toBe('Line one.\nLine two.');
    }
  });

  it('accepts the documented maximum lengths', () => {
    const result = validateContactPayload(
      validPayload({
        name: 'N'.repeat(100),
        message: 'M'.repeat(5_000),
        turnstileToken: 'T'.repeat(2_048),
      }),
    );

    expect(result.ok).toBe(true);
  });

  it('rejects over-limit and control-character values', () => {
    const result = validateContactPayload(
      validPayload({
        name: `${'N'.repeat(100)}X`,
        email: 'jane\n@example.com',
        message: `Valid text\u0000${'M'.repeat(5_000)}`,
        turnstileToken: 'T'.repeat(2_049),
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields).toMatchObject({
        name: expect.any(String),
        email: expect.any(String),
        message: expect.any(String),
        verification: expect.any(String),
      });
    }
  });

  it('requires a category from the server-owned enum and privacy consent', () => {
    const result = validateContactPayload(
      validPayload({ category: 'billing', privacyAccepted: 'yes' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields.category).toBeDefined();
      expect(result.fields.privacyAccepted).toBeDefined();
    }
  });

  it('rejects a literal false privacy acknowledgement', () => {
    const result = validateContactPayload(
      validPayload({ privacyAccepted: false }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields.privacyAccepted).toBe(
        'Confirm the privacy acknowledgement.',
      );
    }
  });

  it('rejects unknown keys', () => {
    const result = validateContactPayload(validPayload({ admin: true }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields.form).toBe('The form contains unsupported fields.');
    }
  });

  it('detects a string honeypot without treating non-strings as a hit', () => {
    expect(isHoneypotTriggered(validPayload({ website: 'bot value' }))).toBe(
      true,
    );
    expect(
      isHoneypotTriggered(validPayload({ website: { value: 'bot' } })),
    ).toBe(false);
  });
});

describe('join payload validation', () => {
  it('accepts and normalizes the one-email request contract', () => {
    const result = validateJoinPayload(
      validJoinPayload({
        email: '  researcher@tsinghua.edu.cn  ',
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.email).toBe('researcher@tsinghua.edu.cn');
      expect(result.value.joinSlack).toBe(true);
      expect(result.value.joinMailingList).toBe(true);
    }
  });

  it('accepts Slack-only and personal email addresses', () => {
    const result = validateJoinPayload(
      validJoinPayload({
        email: 'researcher@gmail.com',
        joinSlack: true,
        joinMailingList: false,
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.joinSlack).toBe(true);
      expect(result.value.joinMailingList).toBe(false);
    }
  });

  it('accepts a mailing-list-only request', () => {
    const result = validateJoinPayload(
      validJoinPayload({
        joinSlack: false,
        joinMailingList: true,
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.joinSlack).toBe(false);
      expect(result.value.joinMailingList).toBe(true);
    }
  });

  it('requires at least one requested service and a valid email', () => {
    const result = validateJoinPayload(
      validJoinPayload({
        email: 'not-an-email',
        joinSlack: false,
        joinMailingList: false,
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields).toMatchObject({
        email: expect.any(String),
        services: expect.any(String),
      });
    }
  });

  it('requires actual boolean service selections', () => {
    const result = validateJoinPayload(
      validJoinPayload({ joinSlack: 'true', joinMailingList: 1 }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields.joinSlack).toBeDefined();
      expect(result.fields.joinMailingList).toBeDefined();
    }
  });

  it('rejects obsolete or unknown join fields', () => {
    const result = validateJoinPayload(
      validJoinPayload({ organization: 'Example Institute', admin: true }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields.form).toBe('The form contains unsupported fields.');
    }
  });

  it('requires a bounded Turnstile token and an empty honeypot', () => {
    const result = validateJoinPayload(
      validJoinPayload({ website: 'bot', turnstileToken: '' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields.form).toBe('The form could not be validated.');
      expect(result.fields.verification).toBeDefined();
    }
  });
});

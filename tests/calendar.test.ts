import { describe, it, expect } from 'vitest';
import {
  accessError,
  foldIcs,
  sessionCalendar,
  type CalendarSession,
} from '../src/lib/calendar';

const event: CalendarSession = {
  id: 'session-test',
  date: '2026-09-18',
  time: '09:00',
  timezone: 'America/New_York',
  durationMinutes: 60,
  speakers: [
    {
      name: 'Riley McMahon',
      affiliation: 'University of Cambridge',
      talkTitle: 'Development, tissues; cells\\signals\nSecond line',
    },
  ],
  access: {
    url: 'https://example.zoom.us/j/12345678901?pwd=abc%2BDEF.1&from=calendar',
    meetingId: '123 4567 8901',
    passcode: 'new-pass',
  },
};
const unfold = (text: string) => text.replace(/\r\n[ \t]/g, '');
describe('session calendars', () => {
  it('folds UTF-8 without losing spaces, unicode, words or URLs', () => {
    const original = 'DESCRIPTION:' + '张三 🧬 Riley McMahon '.repeat(15);
    const folded = foldIcs(original);
    expect(unfold(folded)).toBe(original);
    for (const line of folded.split('\r\n'))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    const ics = sessionCalendar(
      event,
      'https://vgzt.org',
      new Date('2026-09-01T01:02:03Z'),
    );
    expect(unfold(ics)).toContain(`URL:${event.access!.url}\r\n`);
    expect(unfold(ics)).toContain('Riley McMahon');
    expect(unfold(ics)).toContain(
      'Development\\, tissues\\; cells\\\\signals\\nSecond line',
    );
    expect(ics).toContain('DTSTAMP:20260901T010203Z');
    expect(ics).toContain('DTSTART:20260918T130000Z');
    expect(ics).toContain('DTEND:20260918T140000Z');
    expect(unfold(ics)).toContain('Passcode: new-pass');
    expect(ics.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/);
  });
  it('uses date-aware DST and stable, event-specific UIDs', () => {
    expect(
      sessionCalendar({ ...event, date: '2026-12-18' }, 'https://vgzt.org'),
    ).toContain('DTSTART:20261218T140000Z');
    expect(sessionCalendar(event, 'https://vgzt.org')).toContain(
      'UID:session-test@vgzt.org',
    );
    expect(
      sessionCalendar({ ...event, id: 'another-event' }, 'https://vgzt.org'),
    ).toContain('UID:another-event@vgzt.org');
    expect(() =>
      sessionCalendar(
        { ...event, date: '2026-03-08', time: '02:30' },
        'https://vgzt.org',
      ),
    ).toThrow();
  });
  it('rejects incomplete or mismatched access instead of reusing old credentials', () => {
    expect(accessError(null)).toBeNull();
    expect(accessError({ url: event.access!.url })).not.toBeNull();
    expect(accessError({ ...event.access, meetingId: '999' })).not.toBeNull();
    expect(
      accessError({
        ...event.access,
        url: 'https://zoom.us.evil.test/j/12345678901',
      }),
    ).not.toBeNull();
    expect(accessError(event.access)).toBeNull();
  });
});

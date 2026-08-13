import { describe, expect, it } from 'vitest';
import {
  canonicalEventInstant,
  chooseTimeZone,
  eventPartsInZone,
  formatEventTime,
  type ScheduledEventTime,
} from '../src/lib/time';

const daylightEvent: ScheduledEventTime = {
  date: '2026-09-18',
  time: '12:30',
  timezone: 'America/New_York',
  durationMinutes: 60,
};

const standardEvent: ScheduledEventTime = {
  date: '2027-01-15',
  time: '12:30',
  timezone: 'America/New_York',
  durationMinutes: 60,
};

const lateEvent: ScheduledEventTime = {
  date: '2026-09-18',
  time: '21:00',
  timezone: 'America/New_York',
  durationMinutes: 60,
};

describe('VGZT canonical scheduling', () => {
  it('uses New York daylight-saving rules rather than a fixed offset', () => {
    expect(canonicalEventInstant(daylightEvent).toString()).toBe(
      '2026-09-18T16:30:00Z',
    );
    expect(canonicalEventInstant(standardEvent).toString()).toBe(
      '2027-01-15T17:30:00Z',
    );
  });

  it.each([
    ['America/New_York', '2026-09-18', '12:30', '2027-01-15', '12:30'],
    ['America/Los_Angeles', '2026-09-18', '09:30', '2027-01-15', '09:30'],
    ['Europe/London', '2026-09-18', '17:30', '2027-01-15', '17:30'],
    ['Europe/Berlin', '2026-09-18', '18:30', '2027-01-15', '18:30'],
    ['Asia/Shanghai', '2026-09-19', '00:30', '2027-01-16', '01:30'],
    ['Asia/Tokyo', '2026-09-19', '01:30', '2027-01-16', '02:30'],
    ['Australia/Sydney', '2026-09-19', '02:30', '2027-01-16', '04:30'],
  ])(
    'converts daylight and standard events for %s',
    (zone, daylightDate, daylightTime, standardDate, standardTime) => {
      expect(eventPartsInZone(daylightEvent, zone)).toMatchObject({
        date: daylightDate,
        time: daylightTime,
      });
      expect(eventPartsInZone(standardEvent, zone)).toMatchObject({
        date: standardDate,
        time: standardTime,
      });
    },
  );

  it.each([
    ['America/New_York', '2026-09-18', '21:00'],
    ['America/Los_Angeles', '2026-09-18', '18:00'],
    ['Europe/London', '2026-09-19', '02:00'],
    ['Europe/Berlin', '2026-09-19', '03:00'],
    ['Asia/Shanghai', '2026-09-19', '09:00'],
    ['Asia/Tokyo', '2026-09-19', '10:00'],
    ['Australia/Sydney', '2026-09-19', '11:00'],
  ])(
    'derives the correct local date for a 21:00 ET event in %s',
    (zone, date, time) => {
      expect(eventPartsInZone(lateEvent, zone)).toMatchObject({ date, time });
    },
  );

  it('preserves reference Eastern time while formatting local time', () => {
    const formatted = formatEventTime(daylightEvent, 'Europe/London');
    expect(formatted.local).toMatchObject({
      date: '2026-09-18',
      time: '17:30',
    });
    expect(formatted.reference).toMatchObject({
      date: '2026-09-18',
      time: '12:30',
      timeZone: 'America/New_York',
    });
  });

  it('prefers a valid manual timezone and safely falls back', () => {
    expect(chooseTimeZone('Asia/Tokyo', 'Europe/London')).toBe('Asia/Tokyo');
    expect(chooseTimeZone('Invalid/Nowhere', 'Europe/London')).toBe(
      'Europe/London',
    );
    expect(chooseTimeZone(null, undefined)).toBe('UTC');
  });
});

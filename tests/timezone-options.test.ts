import { describe, expect, it } from 'vitest';
import { isValidTimeZone } from '../src/lib/time';
import { CURATED_TIME_ZONE_OPTIONS } from '../src/lib/timezone-options';

describe('curated timezone selector options', () => {
  it('keeps a short unique list of canonical IANA timezones', () => {
    const values = CURATED_TIME_ZONE_OPTIONS.map(({ value }) => value);

    expect(values).toHaveLength(8);
    expect(new Set(values).size).toBe(values.length);
    expect(values.every(isValidTimeZone)).toBe(true);
  });

  it('uses DST-aware user-facing labels where seasonal names differ', () => {
    expect(CURATED_TIME_ZONE_OPTIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: 'Europe/London',
          label: expect.stringContaining('GMT/BST'),
        }),
        expect.objectContaining({
          value: 'America/New_York',
          label: expect.stringContaining('EST/EDT'),
        }),
        expect.objectContaining({
          value: 'Asia/Kolkata',
          label: expect.stringContaining('India Standard Time'),
        }),
      ]),
    );
  });
});

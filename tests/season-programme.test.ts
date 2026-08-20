import { describe, expect, it } from 'vitest';
import {
  archiveAutoplayEnabled,
  defaultProgrammeSeasonId,
  programmeSeasonIds,
} from '../src/lib/season-programme';

const seasons = [
  { id: 'season-08', season: 8, status: 'draft' as const },
  { id: 'season-07', season: 7, status: 'archived' as const },
];

describe('homepage programme season selection', () => {
  it('defaults to the current season even when it has no published events', () => {
    expect(
      defaultProgrammeSeasonId('season-08', seasons, [
        { season: 'season-07', status: 'published' },
      ]),
    ).toBe('season-08');
  });

  it('automatically defaults to Season 8 once it has an event', () => {
    expect(
      defaultProgrammeSeasonId('season-08', seasons, [
        { season: 'season-07', status: 'published' },
        { season: 'season-08', status: 'published' },
      ]),
    ).toBe('season-08');
  });

  it('retains Season 7 in the switcher after Season 8 publishes', () => {
    expect(
      programmeSeasonIds('season-08', seasons, [
        { season: 'season-07', status: 'published' },
        { season: 'season-08', status: 'published' },
      ]),
    ).toEqual(['season-08', 'season-07']);
  });

  it('disables archive autoplay for reduced motion', () => {
    expect(archiveAutoplayEnabled(28, true)).toBe(false);
    expect(archiveAutoplayEnabled(28, false)).toBe(true);
  });
});

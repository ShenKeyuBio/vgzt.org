import { describe, expect, it } from 'vitest';
import { seasonDotCount } from '../src/lib/brand';

describe('VGZT season mark', () => {
  it('renders one dot for each current season number', () => {
    expect(seasonDotCount(8)).toBe(8);
  });

  it.each([null, undefined, 0, -1, 2.5])(
    'uses the historical four-dot fallback for invalid season %s',
    (season) => {
      expect(seasonDotCount(season)).toBe(4);
    },
  );
});

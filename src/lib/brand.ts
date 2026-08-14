const DEFAULT_SEASON_DOT_COUNT = 4;

export function seasonDotCount(seasonNumber?: number | null): number {
  if (
    typeof seasonNumber === 'number' &&
    Number.isInteger(seasonNumber) &&
    seasonNumber > 0
  ) {
    return seasonNumber;
  }

  return DEFAULT_SEASON_DOT_COUNT;
}

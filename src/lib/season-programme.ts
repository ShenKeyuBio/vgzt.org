export interface ProgrammeSeasonLike {
  id: string;
  season: number;
  status: 'draft' | 'published' | 'archived';
}

export interface ProgrammeEventLike {
  season: string;
  status: 'draft' | 'published' | 'cancelled';
}

export function programmeSeasonIds(
  currentSeasonId: string,
  seasons: readonly ProgrammeSeasonLike[],
  events: readonly ProgrammeEventLike[],
): string[] {
  const withPublishedEvents = new Set(
    events
      .filter(({ status }) => status === 'published')
      .map(({ season }) => season),
  );
  const archives = seasons
    .filter(
      ({ id, status }) =>
        id !== currentSeasonId &&
        status === 'archived' &&
        withPublishedEvents.has(id),
    )
    .sort((a, b) => b.season - a.season)
    .map(({ id }) => id);
  return [currentSeasonId, ...archives];
}

export function defaultProgrammeSeasonId(
  currentSeasonId: string,
  _seasons: readonly ProgrammeSeasonLike[],
  _events: readonly ProgrammeEventLike[],
): string {
  return currentSeasonId;
}

export function archiveAutoplayEnabled(
  eventCount: number,
  reducedMotion: boolean,
): boolean {
  return eventCount > 1 && !reducedMotion;
}

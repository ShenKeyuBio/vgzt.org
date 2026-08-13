import { Temporal } from '@js-temporal/polyfill';
import {
  canonicalEventInstant,
  coerceInstant,
  eventEndInstant,
  type InstantInput,
} from './time';

export interface SelectableEvent {
  id: string;
  status: 'draft' | 'published' | 'cancelled';
  date: string | null;
  time: string | null;
  timezone: string;
  durationMinutes?: number;
}

interface ResolvedEvent<T extends SelectableEvent> {
  event: T;
  startsAt: Temporal.Instant;
  endsAt: Temporal.Instant;
}

function resolvePublished<T extends SelectableEvent>(
  event: T,
): ResolvedEvent<T> | null {
  if (
    event.status !== 'published' ||
    event.date === null ||
    event.time === null
  )
    return null;
  const scheduled = { ...event, date: event.date, time: event.time };
  return {
    event,
    startsAt: canonicalEventInstant(scheduled),
    endsAt: eventEndInstant(scheduled),
  };
}

function compareAscending<T extends SelectableEvent>(
  first: ResolvedEvent<T>,
  second: ResolvedEvent<T>,
): number {
  return (
    Temporal.Instant.compare(first.startsAt, second.startsAt) ||
    first.event.id.localeCompare(second.event.id)
  );
}

/**
 * Selects the live or nearest upcoming published event. Once no event is live or
 * upcoming, it falls back to the most recently completed published event.
 */
export function selectDefaultEvent<T extends SelectableEvent>(
  events: readonly T[],
  now: InstantInput = Temporal.Now.instant(),
): T | null {
  const instant = coerceInstant(now);
  const resolved = events
    .map(resolvePublished)
    .filter((event): event is ResolvedEvent<T> => event !== null);

  const liveOrUpcoming = resolved
    .filter(({ endsAt }) => Temporal.Instant.compare(endsAt, instant) >= 0)
    .sort(compareAscending);
  if (liveOrUpcoming[0]) return liveOrUpcoming[0].event;

  const completed = resolved.sort((first, second) => {
    return (
      Temporal.Instant.compare(second.endsAt, first.endsAt) ||
      first.event.id.localeCompare(second.event.id)
    );
  });
  return completed[0]?.event ?? null;
}

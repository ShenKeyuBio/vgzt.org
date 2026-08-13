import { describe, expect, it } from 'vitest';
import {
  selectDefaultEvent,
  type SelectableEvent,
} from '../src/lib/event-selection';

function event(
  id: string,
  date: string,
  time = '12:30',
  status: SelectableEvent['status'] = 'published',
): SelectableEvent {
  return {
    id,
    status,
    date,
    time,
    timezone: 'America/New_York',
    durationMinutes: 60,
  };
}

describe('default event selection', () => {
  it('selects the nearest upcoming published event from unsorted data', () => {
    const events = [
      event('later', '2026-10-02'),
      event('draft-nearer', '2026-09-19', '12:30', 'draft'),
      event('nearest', '2026-09-25'),
      event('cancelled-nearer', '2026-09-20', '12:30', 'cancelled'),
      event('past', '2026-09-18'),
    ];
    expect(selectDefaultEvent(events, '2026-09-19T12:00:00Z')?.id).toBe(
      'nearest',
    );
  });

  it('keeps a currently live event selected through its exact end instant', () => {
    const current = event('current', '2026-09-18');
    const next = event('next', '2026-09-25');
    expect(
      selectDefaultEvent([next, current], '2026-09-18T16:45:00Z')?.id,
    ).toBe('current');
    expect(
      selectDefaultEvent([next, current], '2026-09-18T17:30:00Z')?.id,
    ).toBe('current');
    expect(
      selectDefaultEvent([next, current], '2026-09-18T17:30:00.001Z')?.id,
    ).toBe('next');
  });

  it('falls back to the most recently completed event', () => {
    expect(
      selectDefaultEvent(
        [event('older', '2026-09-18'), event('recent', '2026-09-25')],
        '2026-10-01T00:00:00Z',
      )?.id,
    ).toBe('recent');
  });

  it('returns null when no published event exists', () => {
    expect(
      selectDefaultEvent([event('draft', '2026-09-18', '12:30', 'draft')]),
    ).toBeNull();
  });

  it('uses a stable ID tie-breaker', () => {
    expect(
      selectDefaultEvent(
        [event('same-b', '2026-09-18'), event('same-a', '2026-09-18')],
        '2026-09-01T00:00:00Z',
      )?.id,
    ).toBe('same-a');
  });
});

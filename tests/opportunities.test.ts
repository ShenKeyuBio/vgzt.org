import { describe, expect, it } from 'vitest';
import {
  filterOpportunities,
  getActiveOpportunities,
  hasOpportunityDeadlinePassed,
  isOpportunityActive,
  type OpportunityRecord,
} from '../src/lib/opportunities';

function opportunity(
  id: string,
  overrides: Partial<OpportunityRecord> = {},
): OpportunityRecord {
  return {
    id,
    type: 'job',
    postedAt: '2026-10-01',
    deadline: null,
    expiresAt: null,
    featured: false,
    status: 'published',
    ...overrides,
  };
}

describe('opportunity visibility', () => {
  const today = '2026-10-10';

  it('treats expiresAt as inclusive', () => {
    expect(
      isOpportunityActive(
        opportunity('expired', { expiresAt: '2026-10-09' }),
        today,
      ),
    ).toBe(false);
    expect(
      isOpportunityActive(opportunity('last-day', { expiresAt: today }), today),
    ).toBe(true);
    expect(
      isOpportunityActive(
        opportunity('future', { expiresAt: '2026-10-11' }),
        today,
      ),
    ).toBe(true);
  });

  it('omits drafts, archives, and expired featured entries', () => {
    const active = getActiveOpportunities(
      [
        opportunity('draft', { status: 'draft' }),
        opportunity('archived', { status: 'archived' }),
        opportunity('featured-expired', {
          featured: true,
          expiresAt: '2026-10-09',
        }),
        opportunity('active'),
      ],
      today,
    );
    expect(active.map(({ id }) => id)).toEqual(['active']);
  });

  it('does not silently expire an entry when only its deadline has passed', () => {
    const listing = opportunity('deadline-passed', {
      deadline: '2026-10-09',
      expiresAt: '2026-10-20',
    });
    expect(isOpportunityActive(listing, today)).toBe(true);
    expect(hasOpportunityDeadlinePassed(listing, today)).toBe(true);
  });

  it('sorts featured first, then newest, and applies type filters', () => {
    const listings = [
      opportunity('old-job', { postedAt: '2026-09-01' }),
      opportunity('new-job', { postedAt: '2026-10-02' }),
      opportunity('featured-postdoc', { type: 'postdoc', featured: true }),
    ];
    expect(getActiveOpportunities(listings, today).map(({ id }) => id)).toEqual(
      ['featured-postdoc', 'new-job', 'old-job'],
    );
    expect(
      filterOpportunities(listings, 'job', today).map(({ id }) => id),
    ).toEqual(['new-job', 'old-job']);
  });
});

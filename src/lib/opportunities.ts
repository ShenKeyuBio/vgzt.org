export const OPPORTUNITY_TYPES = [
  'job',
  'phd',
  'postdoc',
  'funding',
  'event',
  'community',
] as const;

export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];
export type OpportunityFilter = 'all' | OpportunityType;

export interface OpportunityRecord {
  id: string;
  type: OpportunityType;
  postedAt: string;
  deadline: string | null;
  expiresAt: string | null;
  featured: boolean;
  status: 'draft' | 'published' | 'archived';
}

export function isoToday(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isOpportunityActive(
  opportunity: OpportunityRecord,
  today = isoToday(),
): boolean {
  return (
    opportunity.status === 'published' &&
    (opportunity.expiresAt === null || opportunity.expiresAt >= today)
  );
}

export function hasOpportunityDeadlinePassed(
  opportunity: OpportunityRecord,
  today = isoToday(),
): boolean {
  return opportunity.deadline !== null && opportunity.deadline < today;
}

function sortActive<T extends OpportunityRecord>(first: T, second: T): number {
  if (first.featured !== second.featured) return first.featured ? -1 : 1;
  return (
    second.postedAt.localeCompare(first.postedAt) ||
    first.id.localeCompare(second.id)
  );
}

export function getActiveOpportunities<T extends OpportunityRecord>(
  opportunities: readonly T[],
  today = isoToday(),
): T[] {
  return opportunities
    .filter((item) => isOpportunityActive(item, today))
    .sort(sortActive);
}

export function filterOpportunities<T extends OpportunityRecord>(
  opportunities: readonly T[],
  filter: OpportunityFilter,
  today = isoToday(),
): T[] {
  return getActiveOpportunities(opportunities, today).filter(
    (item) => filter === 'all' || item.type === filter,
  );
}

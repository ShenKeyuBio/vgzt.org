export interface TimeZoneOption {
  value: string;
  label: string;
}

export const CURATED_TIME_ZONE_OPTIONS: readonly TimeZoneOption[] = [
  {
    value: 'America/New_York',
    label: 'New York — Eastern Time (EST/EDT)',
  },
  {
    value: 'America/Los_Angeles',
    label: 'Los Angeles — Pacific Time (PST/PDT)',
  },
  {
    value: 'Europe/London',
    label: 'London — UK time (GMT/BST)',
  },
  {
    value: 'Europe/Berlin',
    label: 'Berlin — Central Europe (CET/CEST)',
  },
  { value: 'Asia/Shanghai', label: 'Shanghai — China Standard Time' },
  { value: 'Asia/Kolkata', label: 'India — India Standard Time' },
  { value: 'Asia/Tokyo', label: 'Tokyo — Japan Standard Time' },
  {
    value: 'Australia/Sydney',
    label: 'Sydney — Eastern Australia (AEST/AEDT)',
  },
] as const;

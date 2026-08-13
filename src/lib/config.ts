import { chooseTimeZone, isValidTimeZone } from './time';

export const POSTER_FALLBACK_PATH = '/assets/poster-placeholder.svg';
export const TIME_ZONE_STORAGE_KEY = 'vgzt-timezone';

export interface AbstractCallConfig {
  open: boolean;
  formUrl: string | null;
}

export interface AbstractCallState {
  mode: 'closed' | 'open' | 'open-pending-link';
  showBanner: boolean;
  canSubmit: boolean;
  ctaUrl: string | null;
}

export interface ResolvedPoster<T> {
  src: T | string;
  alt: string;
  isPlaceholder: boolean;
}

export function safeHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function getAbstractCallState(
  config: AbstractCallConfig,
): AbstractCallState {
  if (!config.open) {
    return {
      mode: 'closed',
      showBanner: false,
      canSubmit: false,
      ctaUrl: null,
    };
  }

  const ctaUrl = safeHttpsUrl(config.formUrl);
  if (ctaUrl === null) {
    return {
      mode: 'open-pending-link',
      showBanner: true,
      canSubmit: false,
      ctaUrl: null,
    };
  }

  return { mode: 'open', showBanner: true, canSubmit: true, ctaUrl };
}

export function resolvePoster<T>(
  poster: T | null | undefined,
  posterAlt: string | null | undefined,
): ResolvedPoster<T> {
  if (poster === null || poster === undefined) {
    return {
      src: POSTER_FALLBACK_PATH,
      alt: 'Poster coming soon',
      isPlaceholder: true,
    };
  }

  return {
    src: poster,
    alt: posterAlt?.trim() || 'VGZT event poster',
    isPlaceholder: false,
  };
}

export function resolveConfiguredTimeZone(
  storedValue: string | null | undefined,
  detectedValue: string | null | undefined,
): { timeZone: string; invalidStoredValue: boolean } {
  return {
    timeZone: chooseTimeZone(storedValue, detectedValue),
    invalidStoredValue: Boolean(storedValue && !isValidTimeZone(storedValue)),
  };
}

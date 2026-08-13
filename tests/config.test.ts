import { describe, expect, it } from 'vitest';
import {
  POSTER_FALLBACK_PATH,
  getAbstractCallState,
  resolveConfiguredTimeZone,
  resolvePoster,
} from '../src/lib/config';

describe('abstract-call display state', () => {
  it('hides the banner while the call is closed', () => {
    expect(
      getAbstractCallState({
        open: false,
        formUrl: 'https://example.org/form',
      }),
    ).toEqual({
      mode: 'closed',
      showBanner: false,
      canSubmit: false,
      ctaUrl: null,
    });
  });

  it('enables the CTA only for an open call with a valid HTTPS URL', () => {
    expect(
      getAbstractCallState({ open: true, formUrl: 'https://example.org/form' }),
    ).toMatchObject({
      mode: 'open',
      showBanner: true,
      canSubmit: true,
      ctaUrl: 'https://example.org/form',
    });
  });

  it.each([null, '#', 'javascript:void(0)', 'http://example.org/form'])(
    'keeps an open call visible but non-clickable for unresolved URL %s',
    (formUrl) => {
      expect(getAbstractCallState({ open: true, formUrl })).toEqual({
        mode: 'open-pending-link',
        showBanner: true,
        canSubmit: false,
        ctaUrl: null,
      });
    },
  );
});

describe('missing poster handling', () => {
  it('uses the stable local fallback without a broken image source', () => {
    expect(resolvePoster(null, null)).toEqual({
      src: POSTER_FALLBACK_PATH,
      alt: 'Poster coming soon',
      isPlaceholder: true,
    });
  });

  it('preserves an Astro image object and approved alt text', () => {
    const image = { src: '/_assets/poster.webp', width: 1000, height: 1400 };
    expect(resolvePoster(image, 'Poster for a confirmed VGZT seminar')).toEqual(
      {
        src: image,
        alt: 'Poster for a confirmed VGZT seminar',
        isPlaceholder: false,
      },
    );
  });
});

describe('timezone preference resolution', () => {
  it('flags a bad saved override and falls back to detection', () => {
    expect(resolveConfiguredTimeZone('Not/AZone', 'Europe/London')).toEqual({
      timeZone: 'Europe/London',
      invalidStoredValue: true,
    });
  });
});

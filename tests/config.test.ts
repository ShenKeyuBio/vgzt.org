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
        state: 'closed',
        formUrl: 'https://example.org/form',
      }),
    ).toEqual({
      mode: 'closed',
      showBanner: false,
      canSubmit: false,
      ctaUrl: null,
      ctaLabel: null,
      external: false,
    });
  });

  it('links the opening-soon state to the public details page', () => {
    expect(
      getAbstractCallState({ state: 'opening-soon', formUrl: null }),
    ).toEqual({
      mode: 'opening-soon',
      showBanner: true,
      canSubmit: false,
      ctaUrl: '/abstracts/',
      ctaLabel: 'View abstract call',
      external: false,
    });
  });

  it('routes a valid open call to the embedded submission section', () => {
    expect(
      getAbstractCallState({
        state: 'open',
        formUrl: 'https://example.org/form',
      }),
    ).toMatchObject({
      mode: 'open',
      showBanner: true,
      canSubmit: true,
      ctaUrl: '/abstracts/#submit',
      ctaLabel: 'Open call for talks',
      external: false,
    });
  });

  it('keeps an open call visible without a submission URL', () => {
    expect(getAbstractCallState({ state: 'open', formUrl: null })).toEqual({
      mode: 'open',
      showBanner: true,
      canSubmit: false,
      ctaUrl: '/abstracts/',
      ctaLabel: 'View abstract call',
      external: false,
    });
  });

  it.each(['#', 'javascript:void(0)'])(
    'rejects a malformed submission URL %s',
    (formUrl) => {
      expect(getAbstractCallState({ state: 'open', formUrl })).toEqual({
        mode: 'open',
        showBanner: true,
        canSubmit: false,
        ctaUrl: '/abstracts/',
        ctaLabel: 'View abstract call',
        external: false,
      });
    },
  );

  it('rejects an HTTP submission URL', () => {
    expect(
      getAbstractCallState({
        state: 'open',
        formUrl: 'http://example.org/form',
      }),
    ).toEqual({
      mode: 'open',
      showBanner: true,
      canSubmit: false,
      ctaUrl: '/abstracts/',
      ctaLabel: 'View abstract call',
      external: false,
    });
  });
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

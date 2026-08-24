import { describe, expect, it } from 'vitest';
import { getFooterSocial, getSocialSettings } from '../src/lib/site-data';

describe('subscription configuration', () => {
  it('keeps provider delivery details out of static social data', () => {
    const social = getSocialSettings();

    expect(social).toEqual({
      linkedinUrl:
        'https://www.linkedin.com/company/virtual-gastrulation-zoom-talks-vgzt/',
      blueskyUrl: 'https://bsky.app/profile/vgzt2021.bsky.social',
      xUrl: 'https://x.com/VGZT2020_21',
      instagramUrl: 'https://www.instagram.com/vgzt_gastrulation_talks/',
    });
    expect(getFooterSocial(social)).toEqual(
      expect.arrayContaining([
        { label: 'Mailing list', url: '/subscribe/', external: false },
        { label: 'Slack', url: '/subscribe/', external: false },
      ]),
    );
  });
});

import { describe, expect, it } from 'vitest';
import { getFooterSocial, getSocialSettings } from '../src/lib/site-data';
import { resolveSubscriptionFlow } from '../src/lib/subscription';

const SLACK_URL =
  'https://join.slack.com/t/gastrulationseminars/shared_invite/zt-3ygitwchd-AD29YjXgMZ7Md~RpDggsww';
const NEWSLETTER_SCRIPT_URL =
  'https://eomail5.com/form/4af754d8-9823-11f1-8450-adb50bbcb42e.js';
const NEWSLETTER_FORM_ID = '4af754d8-9823-11f1-8450-adb50bbcb42e';
const links = {
  slackInviteUrl: SLACK_URL,
  newsletterUrl: null,
  newsletterEmbedScriptUrl: NEWSLETTER_SCRIPT_URL,
  newsletterFormId: NEWSLETTER_FORM_ID,
};

describe('subscription choices', () => {
  it('returns only the Slack action for Slack-only selection', () => {
    expect(
      resolveSubscriptionFlow(
        'primary',
        { joinSlack: true, joinMailingList: false },
        links,
      ),
    ).toMatchObject({
      valid: true,
      notifyOrganizers: false,
      slackUrl: SLACK_URL,
      newsletter: null,
    });
  });

  it('returns only the embedded form for mailing-only selection', () => {
    expect(
      resolveSubscriptionFlow(
        'primary',
        { joinSlack: false, joinMailingList: true },
        links,
      ),
    ).toMatchObject({
      valid: true,
      notifyOrganizers: false,
      slackUrl: null,
      newsletter: { state: 'embedded', url: null },
    });
  });

  it('returns both relevant results when both are selected', () => {
    expect(
      resolveSubscriptionFlow(
        'primary',
        { joinSlack: true, joinMailingList: true },
        links,
      ),
    ).toMatchObject({
      valid: true,
      slackUrl: SLACK_URL,
      newsletter: { state: 'embedded' },
    });
  });

  it('rejects a submission with no selected service', () => {
    expect(
      resolveSubscriptionFlow(
        'primary',
        { joinSlack: false, joinMailingList: false },
        links,
      ),
    ).toEqual({
      valid: false,
      message: 'Select Slack, the mailing list, or both.',
      notifyOrganizers: false,
    });
  });

  it('never notifies organizers in the primary flow', () => {
    expect(
      resolveSubscriptionFlow(
        'primary',
        { joinSlack: true, joinMailingList: false },
        links,
      ).notifyOrganizers,
    ).toBe(false);
  });

  it('notifies organizers only for the explicit manual fallback', () => {
    expect(
      resolveSubscriptionFlow(
        'manual-fallback',
        { joinSlack: true, joinMailingList: false },
        links,
      ).notifyOrganizers,
    ).toBe(true);
  });

  it('automatically exposes a configured newsletter URL', () => {
    expect(
      resolveSubscriptionFlow(
        'primary',
        { joinSlack: false, joinMailingList: true },
        {
          ...links,
          newsletterUrl: 'https://example.org/newsletter',
          newsletterEmbedScriptUrl: null,
          newsletterFormId: null,
        },
      ),
    ).toMatchObject({
      newsletter: {
        state: 'available',
        url: 'https://example.org/newsletter',
      },
    });
  });

  it('keeps a safe coming-soon state if neither embed nor direct URL exists', () => {
    expect(
      resolveSubscriptionFlow(
        'primary',
        { joinSlack: false, joinMailingList: true },
        {
          ...links,
          newsletterEmbedScriptUrl: null,
          newsletterFormId: null,
        },
      ),
    ).toMatchObject({
      newsletter: { state: 'coming-soon', url: null },
    });
  });
});

describe('central social configuration', () => {
  it('contains the supplied canonical links and EmailOctopus embed', () => {
    const social = getSocialSettings();
    expect(social).toEqual({
      newsletterUrl: null,
      newsletterEmbedScriptUrl: NEWSLETTER_SCRIPT_URL,
      newsletterFormId: NEWSLETTER_FORM_ID,
      slackInviteUrl: SLACK_URL,
      linkedinUrl:
        'https://www.linkedin.com/company/virtual-gastrulation-zoom-talks-vgzt/',
      blueskyUrl: 'https://bsky.app/profile/vgzt2021.bsky.social',
      xUrl: 'https://x.com/VGZT2020_21',
      instagramUrl: 'https://www.instagram.com/vgzt_gastrulation_talks/',
    });
    expect(getFooterSocial(social)).toContainEqual({
      label: 'Slack',
      url: '/subscribe/',
      external: false,
    });
    expect(getFooterSocial(social)).toContainEqual({
      label: 'Mailing list',
      url: '/subscribe/',
      external: false,
    });
  });
});

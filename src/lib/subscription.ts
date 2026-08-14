export interface SubscriptionChoices {
  joinSlack: boolean;
  joinMailingList: boolean;
}

export interface SubscriptionLinks {
  slackInviteUrl: string | null;
  newsletterUrl: string | null;
  newsletterEmbedScriptUrl: string | null;
  newsletterFormId: string | null;
}

export type SubscriptionIntent = 'primary' | 'manual-fallback';

export type SubscriptionFlowResult =
  | {
      valid: false;
      message: string;
      notifyOrganizers: false;
    }
  | {
      valid: true;
      notifyOrganizers: boolean;
      slackUrl: string | null;
      newsletter:
        | null
        | { state: 'embedded'; url: null }
        | { state: 'available'; url: string }
        | { state: 'coming-soon'; url: null };
    };

export function resolveSubscriptionFlow(
  intent: SubscriptionIntent,
  choices: SubscriptionChoices,
  links: SubscriptionLinks,
): SubscriptionFlowResult {
  if (!choices.joinSlack && !choices.joinMailingList) {
    return {
      valid: false,
      message: 'Select Slack, the mailing list, or both.',
      notifyOrganizers: false,
    };
  }

  return {
    valid: true,
    notifyOrganizers: intent === 'manual-fallback',
    slackUrl: choices.joinSlack ? links.slackInviteUrl : null,
    newsletter: choices.joinMailingList
      ? links.newsletterEmbedScriptUrl && links.newsletterFormId
        ? { state: 'embedded', url: null }
        : links.newsletterUrl
          ? { state: 'available', url: links.newsletterUrl }
          : { state: 'coming-soon', url: null }
      : null,
  };
}

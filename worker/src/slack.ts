import { CATEGORY_LABELS, type ContactSubmission } from "./contact";
import type { JoinSubmission } from "./join";

const ALLOWED_SLACK_WEBHOOK_HOSTNAMES = new Set([
  "hooks.slack.com",
  "hooks.slack-gov.com",
]);

interface SlackTextObject {
  type: "plain_text";
  text: string;
}

interface SlackPayload {
  text: string;
  blocks: ReadonlyArray<
    | { type: "header"; text: SlackTextObject }
    | { type: "section"; fields: ReadonlyArray<SlackTextObject> }
    | { type: "section"; text: SlackTextObject }
  >;
}

function truncateSlackText(value: string, maximumCodePoints = 2_800): string {
  const codePoints = Array.from(value);
  return codePoints.length <= maximumCodePoints
    ? value
    : `${codePoints.slice(0, maximumCodePoints - 1).join("")}…`;
}

export function buildContactSlackPayload(
  submission: ContactSubmission,
  requestId: string,
): SlackPayload {
  return {
    text: "VGZT Contact form submission",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "VGZT Contact form submission" },
      },
      {
        type: "section",
        fields: [
          {
            type: "plain_text",
            text: `Category: ${CATEGORY_LABELS[submission.category]}`,
          },
          { type: "plain_text", text: `From: ${submission.name}` },
          { type: "plain_text", text: `Reply-to: ${submission.email}` },
          { type: "plain_text", text: `Request ID: ${requestId}` },
        ],
      },
      {
        type: "section",
        text: {
          type: "plain_text",
          text: `Message:\n${truncateSlackText(submission.message)}`,
        },
      },
    ],
  };
}

export function buildJoinSlackPayload(
  submission: JoinSubmission,
  requestId: string,
): SlackPayload {
  const requestedServices = [
    submission.joinSlack ? "Slack" : null,
    submission.joinMailingList ? "mailing list" : null,
  ].filter((service): service is string => service !== null);
  return {
    text: "VGZT Join form submission — manual invitation needed",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "VGZT Join form submission" },
      },
      {
        type: "section",
        fields: [
          { type: "plain_text", text: `Name: ${submission.name}` },
          {
            type: "plain_text",
            text: `Organization: ${submission.organization}`,
          },
          {
            type: "plain_text",
            text: `Career stage: ${submission.careerStage}`,
          },
          { type: "plain_text", text: `Email: ${submission.email}` },
          ...(submission.slackEmail
            ? [
                {
                  type: "plain_text" as const,
                  text: `Slack email: ${submission.slackEmail}`,
                },
              ]
            : []),
          {
            type: "plain_text",
            text: `Requested: ${requestedServices.join(" + ")}`,
          },
          { type: "plain_text", text: `Request ID: ${requestId}` },
        ],
      },
      {
        type: "section",
        text: {
          type: "plain_text",
          text: `Manual action: invite this person to ${requestedServices.join(" + ")}.`,
        },
      },
    ],
  };
}

/** Retained for existing imports; this is the Contact formatter. */
export const buildSlackPayload = buildContactSlackPayload;

function validateWebhookUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !ALLOWED_SLACK_WEBHOOK_HOSTNAMES.has(url.hostname)
  ) {
    throw Object.assign(new Error("Slack webhook is not an allowed HTTPS URL."), {
      code: "SLACK_URL_INVALID",
    });
  }
  return url;
}

async function sendSlackPayload(
  webhookUrl: string,
  payload: SlackPayload,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const endpoint = validateWebhookUrl(webhookUrl).href;
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw Object.assign(new Error("Slack webhook rejected the notification."), {
      code: "SLACK_HTTP_ERROR",
    });
  }
}


export async function sendContactSlack(
  webhookUrl: string,
  submission: ContactSubmission,
  requestId: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await sendSlackPayload(
    webhookUrl,
    buildContactSlackPayload(submission, requestId),
    fetcher,
  );
}

export async function sendJoinSlack(
  webhookUrl: string,
  submission: JoinSubmission,
  requestId: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await sendSlackPayload(
    webhookUrl,
    buildJoinSlackPayload(submission, requestId),
    fetcher,
  );
}

/** Retained for existing imports; sends a Contact notification. */
export const sendSlackMetadata = sendContactSlack;

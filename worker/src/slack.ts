import { CATEGORY_LABELS, type ContactSubmission } from "./contact";

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
  >;
}

export function buildSlackPayload(
  submission: ContactSubmission,
  requestId: string,
): SlackPayload {
  return {
    text: "New VGZT website message",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "New VGZT website message" },
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
    ],
  };
}

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

export async function sendSlackMetadata(
  webhookUrl: string,
  submission: ContactSubmission,
  requestId: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const url = validateWebhookUrl(webhookUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3_000);

  try {
    const response = await fetcher(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildSlackPayload(submission, requestId)),
      signal: controller.signal,
      redirect: "error",
    });

    if (!response.ok) {
      throw Object.assign(new Error("Slack webhook rejected the notification."), {
        code: "SLACK_HTTP_ERROR",
      });
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

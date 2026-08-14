import { describe, expect, it } from "vitest";

import type { ContactSubmission } from "../src/contact";
import { buildContactEmail, buildJoinEmail } from "../src/email";
import type { JoinSubmission } from "../src/join";
import {
  buildJoinSlackPayload,
  buildSlackPayload,
  sendContactSlack,
} from "../src/slack";

const submission: ContactSubmission = {
  name: "Jane <@channel>",
  email: "jane@example.com",
  category: "general",
  message: "Private message body that must not be sent to Slack.",
  privacyAccepted: true,
  turnstileToken: "private-turnstile-token",
};

const joinSubmission: JoinSubmission = {
  name: "Jane <@channel>",
  organization: "Example University",
  careerStage: "Postdoc",
  email: "jane@example.com",
  slackEmail: "jane.slack@example.com",
  joinSlack: true,
  joinMailingList: true,
  privacyAccepted: true,
  turnstileToken: "private-join-turnstile-token",
};

describe("notification formatting", () => {
  it("uses fixed email addressing and a server-generated subject", () => {
    const message = buildContactEmail(submission, {
      from: "contact@vgzt.org",
      to: "organizers@vgzt.org",
      requestId: "request-123",
      receivedAt: new Date("2026-08-13T12:00:00.000Z"),
    });

    expect(message.from).toEqual({
      email: "contact@vgzt.org",
      name: "VGZT website",
    });
    expect(message.to).toBe("organizers@vgzt.org");
    expect(message.replyTo.email).toBe("jane@example.com");
    expect(message.subject).toBe("[VGZT website] General");
    expect(message.text).toContain(submission.message);
    expect(message.text).not.toContain(submission.turnstileToken);
  });

  it("sends the Contact message as plain_text without the Turnstile token", () => {
    const payload = buildSlackPayload(submission, "request-123");
    const serialized = JSON.stringify(payload);

    expect(serialized).toContain(submission.message);
    expect(serialized).not.toContain(submission.turnstileToken);
    expect(serialized).not.toContain("mrkdwn");
    expect(serialized).toContain('"type":"plain_text"');
  });

  it("formats an actionable Join email and Slack notification", () => {
    const email = buildJoinEmail(joinSubmission, {
      from: "contact@vgzt.org",
      to: "organizers@vgzt.org",
      requestId: "join-request-123",
      receivedAt: new Date("2026-08-14T12:00:00.000Z"),
    });
    const slack = buildJoinSlackPayload(joinSubmission, "join-request-123");
    const emailText = JSON.stringify(email);
    const slackText = JSON.stringify(slack);

    expect(email.subject).toBe("[VGZT website] Join request");
    expect(emailText).toContain(joinSubmission.organization);
    expect(emailText).toContain(joinSubmission.slackEmail);
    expect(emailText).not.toContain(joinSubmission.turnstileToken);
    expect(slackText).toContain(joinSubmission.organization);
    expect(slackText).toContain(joinSubmission.careerStage);
    expect(slackText).toContain(joinSubmission.slackEmail);
    expect(slackText).toContain("Slack + mailing list");
    expect(slackText).not.toContain(joinSubmission.turnstileToken);
    expect(slackText).not.toContain("mrkdwn");
  });

  it("formats mailing-list-only requests without a Slack field or action", () => {
    const mailingOnly: JoinSubmission = {
      ...joinSubmission,
      slackEmail: null,
      joinSlack: false,
      joinMailingList: true,
    };
    const email = buildJoinEmail(mailingOnly, {
      from: "contact@vgzt.org",
      to: "organizers@vgzt.org",
      requestId: "join-request-124",
      receivedAt: new Date("2026-08-14T12:00:00.000Z"),
    });
    const slack = buildJoinSlackPayload(mailingOnly, "join-request-124");
    const serialized = `${email.text}\n${JSON.stringify(slack)}`;

    expect(serialized).toContain("mailing list");
    expect(serialized).not.toContain("Slack-linked email");
    expect(serialized).not.toContain("Slack email:");
    expect(serialized).not.toContain("Slack + mailing list");
  });

  it("uses a runtime-minimal fetch with a string endpoint", async () => {
    let inputType = "";
    let requestInit: RequestInit | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      inputType = typeof input;
      requestInit = init;
      return new Response("ok", { status: 200 });
    };

    await sendContactSlack(
      "https://hooks.slack.com/services/test-webhook",
      submission,
      "request-123",
      fetcher,
    );

    expect(inputType).toBe("string");
    expect(requestInit?.method).toBe("POST");
    expect(requestInit?.redirect).toBeUndefined();
    expect(requestInit?.signal).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";

import type { ContactSubmission } from "../src/contact";
import { buildContactEmail, buildJoinEmail } from "../src/email";
import type { JoinSubmission } from "../src/join";
import { buildJoinSlackPayload, buildSlackPayload } from "../src/slack";

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
});

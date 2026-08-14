import { describe, expect, it } from "vitest";

import { MAX_CONTACT_BODY_BYTES } from "../src/body";
import type { ContactSubmission } from "../src/contact";
import {
  handleContactRequest,
  type ContactExecutionContext,
  type ContactHandlerDependencies,
} from "../src/handler";
import type { ContactLogEvent } from "../src/logging";
import type { JoinSubmission } from "../src/join";

const ALLOWED_ORIGIN = "https://vgzt.org";
const API_URL = "https://api.vgzt.org/contact";
const JOIN_API_URL = "https://api.vgzt.org/join";

function validPayload(
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    name: "Jane Smith",
    email: "jane@example.com",
    category: "general",
    message: "I have a question about an upcoming seminar.",
    privacyAccepted: true,
    website: "",
    turnstileToken: "valid-token",
    ...overrides,
  };
}

function postRequest(
  payload: unknown,
  headers: Readonly<Record<string, string>> = {},
  url = API_URL,
): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      origin: ALLOWED_ORIGIN,
      "content-type": "application/json; charset=utf-8",
      "cf-connecting-ip": "203.0.113.10",
      ...headers,
    },
    body: JSON.stringify(payload),
  });
}

interface Harness {
  dependencies: ContactHandlerDependencies;
  context: ContactExecutionContext;
  emails: ContactSubmission[];
  joinEmails: JoinSubmission[];
  logs: ContactLogEvent[];
  pending: Promise<unknown>[];
  calls: {
    ipLimit: number;
    emailLimit: number;
    verify: number;
    slack: number;
    joinSlack: number;
  };
}

function createHarness(
  overrides: Partial<ContactHandlerDependencies> = {},
): Harness {
  const emails: ContactSubmission[] = [];
  const joinEmails: JoinSubmission[] = [];
  const logs: ContactLogEvent[] = [];
  const pending: Promise<unknown>[] = [];
  const calls = {
    ipLimit: 0,
    emailLimit: 0,
    verify: 0,
    slack: 0,
    joinSlack: 0,
  };
  const dependencies: ContactHandlerDependencies = {
    createRequestId: () => "00000000-0000-4000-8000-000000000001",
    now: () => new Date("2026-08-13T12:00:00.000Z"),
    limitIp: async () => {
      calls.ipLimit += 1;
      return true;
    },
    limitEmail: async () => {
      calls.emailLimit += 1;
      return true;
    },
    verifyTurnstile: async () => {
      calls.verify += 1;
      return { ok: true };
    },
    sendEmail: async (submission) => {
      emails.push(submission);
    },
    sendJoinEmail: async (submission) => {
      joinEmails.push(submission);
    },
    log: (event) => logs.push(event),
    ...overrides,
  };
  const context: ContactExecutionContext = {
    waitUntil(promise) {
      pending.push(promise);
    },
  };
  return {
    dependencies,
    context,
    emails,
    joinEmails,
    logs,
    pending,
    calls,
  };
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json();
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected an object JSON response.");
  }
  return value as Record<string, unknown>;
}

async function handle(request: Request, harness: Harness): Promise<Response> {
  return handleContactRequest(
    request,
    harness.context,
    {
      allowedOrigins: new Set([ALLOWED_ORIGIN, "https://www.vgzt.org"]),
      contactTurnstileAction: "vgzt_contact",
      joinTurnstileAction: "vgzt_join",
    },
    harness.dependencies,
  );
}

describe("contact handler routing and CORS", () => {
  it("answers an exact-origin preflight without using a wildcard", async () => {
    const harness = createHarness();
    const response = await handle(
      new Request(API_URL, {
        method: "OPTIONS",
        headers: {
          origin: ALLOWED_ORIGIN,
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type",
        },
      }),
      harness,
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      ALLOWED_ORIGIN,
    );
    expect(response.headers.get("access-control-allow-origin")).not.toBe("*");
    expect(response.headers.get("vary")).toContain("Origin");
  });

  it("rejects a disallowed origin without CORS permission", async () => {
    const harness = createHarness();
    const request = postRequest(validPayload(), { origin: "https://attacker.test" });
    const response = await handle(request, harness);

    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(harness.calls.ipLimit).toBe(0);
  });

  it("returns 405 and an Allow header for other methods", async () => {
    const harness = createHarness();
    const response = await handle(
      new Request(API_URL, {
        method: "GET",
        headers: { origin: ALLOWED_ORIGIN },
      }),
      harness,
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST, OPTIONS");
  });
});

describe("contact handler request limits", () => {
  it("rejects malformed JSON without reaching verification or delivery", async () => {
    const harness = createHarness();
    const request = new Request(API_URL, {
      method: "POST",
      headers: {
        origin: ALLOWED_ORIGIN,
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.10",
      },
      body: '{"name":',
    });
    const response = await handle(request, harness);

    expect(response.status).toBe(400);
    expect((await responseJson(response)).code).toBe("INVALID_REQUEST");
    expect(harness.calls.verify).toBe(0);
    expect(harness.calls.emailLimit).toBe(0);
    expect(harness.emails).toHaveLength(0);
  });

  it("rejects unsupported content types", async () => {
    const harness = createHarness();
    const request = postRequest(validPayload(), { "content-type": "text/plain" });
    const response = await handle(request, harness);

    expect(response.status).toBe(415);
    expect((await responseJson(response)).code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("rejects a declared oversized body", async () => {
    const harness = createHarness();
    const request = postRequest(validPayload(), {
      "content-length": String(MAX_CONTACT_BODY_BYTES + 1),
    });
    const response = await handle(request, harness);

    expect(response.status).toBe(413);
    expect((await responseJson(response)).code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("rejects a streamed oversized body when content-length is absent", async () => {
    const harness = createHarness();
    const request = new Request(API_URL, {
      method: "POST",
      headers: {
        origin: ALLOWED_ORIGIN,
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.10",
      },
      body: new Uint8Array(MAX_CONTACT_BODY_BYTES + 1),
    });
    const response = await handle(request, harness);

    expect(response.status).toBe(413);
    expect((await responseJson(response)).code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("short-circuits before parsing when the IP limiter rejects", async () => {
    const harness = createHarness({ limitIp: async () => false });
    const response = await handle(postRequest(validPayload()), harness);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(harness.calls.verify).toBe(0);
    expect(harness.emails).toHaveLength(0);
  });
});

describe("contact handler abuse and delivery flow", () => {
  it("soft-accepts a filled honeypot without verification or delivery", async () => {
    const harness = createHarness();
    const response = await handle(
      postRequest(validPayload({ website: "https://spam.example" })),
      harness,
    );
    const body = await responseJson(response);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(harness.calls.verify).toBe(0);
    expect(harness.calls.emailLimit).toBe(0);
    expect(harness.emails).toHaveLength(0);
    expect(harness.logs.at(-1)?.outcome).toBe("honeypot_discarded");
  });

  it("rejects a Turnstile failure before email delivery", async () => {
    const harness = createHarness({
      verifyTurnstile: async () => ({ ok: false, reason: "hostname" }),
    });
    const response = await handle(postRequest(validPayload()), harness);

    expect(response.status).toBe(422);
    expect((await responseJson(response)).code).toBe("VERIFICATION_FAILED");
    expect(harness.calls.emailLimit).toBe(0);
    expect(harness.emails).toHaveLength(0);
  });

  it("awaits email and schedules a Contact Slack task", async () => {
    const harness = createHarness({
      sendSlack: async () => {
        harness.calls.slack += 1;
      },
    });
    const response = await handle(postRequest(validPayload()), harness);
    await Promise.all(harness.pending);

    expect(response.status).toBe(200);
    expect(harness.calls.verify).toBe(1);
    expect(harness.calls.emailLimit).toBe(1);
    expect(harness.emails).toHaveLength(1);
    expect(harness.calls.slack).toBe(1);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBe(
      "00000000-0000-4000-8000-000000000001",
    );
  });

  it("sends the explicit manual fallback to /join after Turnstile verification", async () => {
    let verifiedAction = "";
    const harness = createHarness({
      verifyTurnstile: async (input) => {
        harness.calls.verify += 1;
        verifiedAction = input.expectedAction;
        return { ok: true };
      },
      sendJoinSlack: async () => {
        harness.calls.joinSlack += 1;
      },
    });
    const joinPayload = {
      name: "Jane Smith",
      organization: "Example University",
      careerStage: "Postdoc",
      email: "jane@example.com",
      slackEmail: "jane.slack@example.com",
      joinSlack: true,
      joinMailingList: true,
      privacyAccepted: true,
      website: "",
      turnstileToken: "valid-token",
    };

    const response = await handle(
      postRequest(joinPayload, {}, JOIN_API_URL),
      harness,
    );
    await Promise.all(harness.pending);

    expect(response.status).toBe(200);
    expect(verifiedAction).toBe("vgzt_join");
    expect(harness.joinEmails).toHaveLength(1);
    expect(harness.emails).toHaveLength(0);
    expect(harness.calls.joinSlack).toBe(1);
    expect(harness.logs.at(-1)).toMatchObject({
      event: "join_submission",
      outcome: "accepted",
    });
  });

  it("returns a generic 503 when email delivery fails", async () => {
    const harness = createHarness({
      sendEmail: async () => {
        throw new Error("TURNSTILE_SECRET=must-not-leak");
      },
    });
    const response = await handle(postRequest(validPayload()), harness);
    const serialized = JSON.stringify(await responseJson(response));

    expect(response.status).toBe(503);
    expect(serialized).not.toContain("must-not-leak");
    expect(serialized).not.toContain("TURNSTILE_SECRET");
  });

  it("does not fail an accepted submission when Slack fails", async () => {
    const harness = createHarness({
      sendSlack: async () => {
        throw Object.assign(new Error("private webhook response"), {
          code: "SLACK_HTTP_ERROR",
        });
      },
    });
    const response = await handle(postRequest(validPayload()), harness);
    await Promise.all(harness.pending);

    expect(response.status).toBe(200);
    expect(harness.logs.some((event) => event.outcome === "slack_failed")).toBe(
      true,
    );
  });
});

import { parseCsvSet } from "./cors";
import { sendContactEmail, sendJoinEmail } from "./email";
import { handleFormRequest, type ContactHandlerDependencies } from "./handler";
import { digestRateLimitKey } from "./hash";
import { structuredLogger } from "./logging";
import { sendContactSlack, sendJoinSlack } from "./slack";
import { verifyTurnstile } from "./turnstile";

function getOptionalSlackWebhook(env: Env): string | undefined {
  const value: unknown = Reflect.get(env, "SLACK_WEBHOOK_URL");
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function createDependencies(env: Env): ContactHandlerDependencies {
  const expectedHostnames = parseCsvSet(env.TURNSTILE_EXPECTED_HOSTNAMES);
  const slackWebhook = getOptionalSlackWebhook(env);
  const dependencies: ContactHandlerDependencies = {
    createRequestId: () => crypto.randomUUID(),
    now: () => new Date(),
    limitIp: async (identifier) => {
      const key = await digestRateLimitKey("contact-ip", identifier);
      const result = await env.CONTACT_IP_RATE.limit({ key });
      return result.success;
    },
    limitEmail: async (identifier) => {
      const key = await digestRateLimitKey("contact-email", identifier);
      const result = await env.CONTACT_EMAIL_RATE.limit({ key });
      return result.success;
    },
    verifyTurnstile: async (input) =>
      verifyTurnstile(input, {
        secret: env.TURNSTILE_SECRET,
        expectedHostnames,
        expectedAction: input.expectedAction,
      }),
    sendEmail: async (submission, requestId, receivedAt) =>
      sendContactEmail(env.CONTACT_EMAIL, submission, {
        from: env.CONTACT_FROM,
        to: env.CONTACT_TO,
        requestId,
        receivedAt,
      }),
    sendJoinEmail: async (submission, requestId, receivedAt) =>
      sendJoinEmail(env.CONTACT_EMAIL, submission, {
        from: env.CONTACT_FROM,
        to: env.CONTACT_TO,
        requestId,
        receivedAt,
      }),
    log: structuredLogger,
  };

  if (slackWebhook === undefined) {
    return dependencies;
  }

  return {
    ...dependencies,
    sendSlack: async (submission, requestId) =>
      sendContactSlack(slackWebhook, submission, requestId),
    sendJoinSlack: async (submission, requestId) =>
      sendJoinSlack(slackWebhook, submission, requestId),
  };
}

export default {
  async fetch(request, env, context): Promise<Response> {
    return handleFormRequest(
      request,
      context,
      {
        allowedOrigins: parseCsvSet(env.ALLOWED_ORIGINS),
        contactTurnstileAction: env.TURNSTILE_EXPECTED_ACTION,
        joinTurnstileAction: env.TURNSTILE_JOIN_EXPECTED_ACTION,
      },
      createDependencies(env),
    );
  },
} satisfies ExportedHandler<Env>;

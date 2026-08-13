import { parseCsvSet } from "./cors";
import { sendContactEmail } from "./email";
import { handleContactRequest, type ContactHandlerDependencies } from "./handler";
import { digestRateLimitKey } from "./hash";
import { structuredLogger } from "./logging";
import { sendSlackMetadata } from "./slack";
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
        expectedAction: env.TURNSTILE_EXPECTED_ACTION,
      }),
    sendEmail: async (submission, requestId, receivedAt) =>
      sendContactEmail(env.CONTACT_EMAIL, submission, {
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
      sendSlackMetadata(slackWebhook, submission, requestId),
  };
}

export default {
  async fetch(request, env, context): Promise<Response> {
    return handleContactRequest(
      request,
      context,
      { allowedOrigins: parseCsvSet(env.ALLOWED_ORIGINS) },
      createDependencies(env),
    );
  },
} satisfies ExportedHandler<Env>;

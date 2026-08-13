import {
  MAX_CONTACT_BODY_BYTES,
  RequestBodyError,
  readJsonBodyLimited,
} from "./body";
import type { ContactSubmission } from "./contact";
import {
  createPreflightResponse,
  getAllowedOrigin,
  isValidPreflight,
} from "./cors";
import { safeErrorCode, type ContactLogger } from "./logging";
import { jsonResponse, successResponse, type ApiErrorBody } from "./responses";
import type { TurnstileVerificationResult } from "./turnstile";
import {
  isHoneypotTriggered,
  normalizeEmailForRateLimit,
  validateContactPayload,
} from "./validation";

export interface ContactExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

export interface ContactHandlerConfig {
  allowedOrigins: ReadonlySet<string>;
  bodyLimitBytes?: number;
}

export interface ContactHandlerDependencies {
  createRequestId(): string;
  now(): Date;
  limitIp(identifier: string): Promise<boolean>;
  limitEmail(identifier: string): Promise<boolean>;
  verifyTurnstile(input: {
    token: string;
    remoteIp: string;
    requestId: string;
  }): Promise<TurnstileVerificationResult>;
  sendEmail(
    submission: ContactSubmission,
    requestId: string,
    receivedAt: Date,
  ): Promise<void>;
  sendSlack?(submission: ContactSubmission, requestId: string): Promise<void>;
  log: ContactLogger;
}

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  INVALID_REQUEST: "The request could not be processed.",
  PAYLOAD_TOO_LARGE: "The submitted form is too large.",
  UNSUPPORTED_MEDIA_TYPE: "Submit the form as JSON.",
};

function errorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string,
  allowedOrigin: string | null,
  fields?: Readonly<Record<string, string>>,
  retryAfter?: number,
): Response {
  const body: ApiErrorBody = {
    ok: false,
    code,
    message,
    requestId,
    ...(fields === undefined ? {} : { fields }),
  };
  return jsonResponse(body, {
    status,
    requestId,
    allowedOrigin,
    ...(retryAfter === undefined ? {} : { retryAfter }),
  });
}

function bodyErrorResponse(
  error: RequestBodyError,
  requestId: string,
  allowedOrigin: string,
): Response {
  return errorResponse(
    error.status,
    error.responseCode,
    ERROR_MESSAGES[error.responseCode] ?? ERROR_MESSAGES.INVALID_REQUEST ?? "Invalid request.",
    requestId,
    allowedOrigin,
  );
}

export async function handleContactRequest(
  request: Request,
  context: ContactExecutionContext,
  config: ContactHandlerConfig,
  dependencies: ContactHandlerDependencies,
): Promise<Response> {
  const requestId = dependencies.createRequestId();
  const allowedOrigin = getAllowedOrigin(request, config.allowedOrigins);
  const url = new URL(request.url);

  try {
    if (url.pathname !== "/contact") {
      return errorResponse(
        404,
        "NOT_FOUND",
        "The requested endpoint does not exist.",
        requestId,
        allowedOrigin,
      );
    }

    if (request.method === "OPTIONS") {
      if (allowedOrigin === null || !isValidPreflight(request)) {
        return errorResponse(
          403,
          "ORIGIN_NOT_ALLOWED",
          "This request origin is not allowed.",
          requestId,
          null,
        );
      }
      return createPreflightResponse(allowedOrigin);
    }

    if (request.method !== "POST") {
      const response = errorResponse(
        405,
        "METHOD_NOT_ALLOWED",
        "This endpoint accepts POST requests only.",
        requestId,
        allowedOrigin,
      );
      response.headers.set("allow", "POST, OPTIONS");
      return response;
    }

    if (allowedOrigin === null) {
      return errorResponse(
        403,
        "ORIGIN_NOT_ALLOWED",
        "This request origin is not allowed.",
        requestId,
        null,
      );
    }

    const remoteIp = request.headers.get("cf-connecting-ip") ?? "unknown";
    let ipAllowed: boolean;
    try {
      ipAllowed = await dependencies.limitIp(remoteIp);
    } catch (error) {
      dependencies.log({
        event: "contact_submission",
        requestId,
        outcome: "rate_limiter_failed",
        errorCode: safeErrorCode(error),
      });
      return errorResponse(
        503,
        "SERVICE_UNAVAILABLE",
        "The contact service is temporarily unavailable.",
        requestId,
        allowedOrigin,
      );
    }

    if (!ipAllowed) {
      dependencies.log({
        event: "contact_submission",
        requestId,
        outcome: "rate_limited",
      });
      return errorResponse(
        429,
        "RATE_LIMITED",
        "Too many attempts. Wait a minute and try again.",
        requestId,
        allowedOrigin,
        undefined,
        60,
      );
    }

    let rawPayload: unknown;
    try {
      rawPayload = await readJsonBodyLimited(
        request,
        config.bodyLimitBytes ?? MAX_CONTACT_BODY_BYTES,
      );
    } catch (error) {
      if (error instanceof RequestBodyError) {
        return bodyErrorResponse(error, requestId, allowedOrigin);
      }
      throw error;
    }

    if (isHoneypotTriggered(rawPayload)) {
      dependencies.log({
        event: "contact_submission",
        requestId,
        outcome: "honeypot_discarded",
      });
      return successResponse(requestId, allowedOrigin);
    }

    const validation = validateContactPayload(rawPayload);
    if (!validation.ok) {
      dependencies.log({
        event: "contact_submission",
        requestId,
        outcome: "validation_failed",
      });
      return errorResponse(
        400,
        "VALIDATION_FAILED",
        "Check the highlighted fields and try again.",
        requestId,
        allowedOrigin,
        validation.fields,
      );
    }

    const verification = await dependencies.verifyTurnstile({
      token: validation.value.turnstileToken,
      remoteIp,
      requestId,
    });
    if (!verification.ok) {
      dependencies.log({
        event: "contact_submission",
        requestId,
        outcome: "verification_failed",
        category: validation.value.category,
        errorCode: verification.reason.toUpperCase(),
      });
      return errorResponse(
        422,
        "VERIFICATION_FAILED",
        "Complete the verification and try again.",
        requestId,
        allowedOrigin,
      );
    }

    let emailAllowed: boolean;
    try {
      emailAllowed = await dependencies.limitEmail(
        normalizeEmailForRateLimit(validation.value.email),
      );
    } catch (error) {
      dependencies.log({
        event: "contact_submission",
        requestId,
        outcome: "rate_limiter_failed",
        category: validation.value.category,
        errorCode: safeErrorCode(error),
      });
      return errorResponse(
        503,
        "SERVICE_UNAVAILABLE",
        "The contact service is temporarily unavailable.",
        requestId,
        allowedOrigin,
      );
    }

    if (!emailAllowed) {
      dependencies.log({
        event: "contact_submission",
        requestId,
        outcome: "rate_limited",
        category: validation.value.category,
      });
      return errorResponse(
        429,
        "RATE_LIMITED",
        "Too many attempts. Wait a minute and try again.",
        requestId,
        allowedOrigin,
        undefined,
        60,
      );
    }

    const receivedAt = dependencies.now();
    try {
      await dependencies.sendEmail(validation.value, requestId, receivedAt);
    } catch (error) {
      dependencies.log({
        event: "contact_submission",
        requestId,
        outcome: "delivery_failed",
        category: validation.value.category,
        errorCode: safeErrorCode(error),
      });
      return errorResponse(
        503,
        "DELIVERY_UNAVAILABLE",
        "The message could not be delivered. Try again later.",
        requestId,
        allowedOrigin,
        undefined,
        60,
      );
    }

    if (dependencies.sendSlack !== undefined) {
      const slackTask = Promise.resolve()
        .then(() => dependencies.sendSlack?.(validation.value, requestId))
        .catch((error: unknown) => {
          dependencies.log({
            event: "contact_submission",
            requestId,
            outcome: "slack_failed",
            category: validation.value.category,
            errorCode: safeErrorCode(error),
          });
        });
      context.waitUntil(slackTask);
    }

    dependencies.log({
      event: "contact_submission",
      requestId,
      outcome: "accepted",
      category: validation.value.category,
    });
    return successResponse(requestId, allowedOrigin);
  } catch (error) {
    dependencies.log({
      event: "contact_submission",
      requestId,
      outcome: "internal_error",
      errorCode: safeErrorCode(error),
    });
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "The contact service is temporarily unavailable.",
      requestId,
      allowedOrigin,
    );
  }
}

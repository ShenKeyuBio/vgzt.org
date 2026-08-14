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
import type { JoinSubmission } from "./join";
import {
  safeErrorCode,
  type ContactLogEvent,
  type ContactLogger,
} from "./logging";
import { jsonResponse, successResponse, type ApiErrorBody } from "./responses";
import type { TurnstileVerificationResult } from "./turnstile";
import {
  isHoneypotTriggered,
  normalizeEmailForRateLimit,
  validateContactPayload,
  validateJoinPayload,
} from "./validation";

export interface ContactExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

export interface ContactHandlerConfig {
  allowedOrigins: ReadonlySet<string>;
  contactTurnstileAction: string;
  joinTurnstileAction: string;
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
    expectedAction: string;
  }): Promise<TurnstileVerificationResult>;
  sendEmail(
    submission: ContactSubmission,
    requestId: string,
    receivedAt: Date,
  ): Promise<void>;
  sendJoinEmail(
    submission: JoinSubmission,
    requestId: string,
    receivedAt: Date,
  ): Promise<void>;
  sendSlack?(submission: ContactSubmission, requestId: string): Promise<void>;
  sendJoinSlack?(submission: JoinSubmission, requestId: string): Promise<void>;
  log: ContactLogger;
}

type FormKind = "contact" | "join";
type FormSubmission =
  | { kind: "contact"; value: ContactSubmission }
  | { kind: "join"; value: JoinSubmission };

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  INVALID_REQUEST: "The request could not be processed.",
  PAYLOAD_TOO_LARGE: "The submitted form is too large.",
  UNSUPPORTED_MEDIA_TYPE: "Submit the form as JSON.",
};

function formKindForPath(pathname: string): FormKind | null {
  if (pathname === "/contact") {
    return "contact";
  }
  if (pathname === "/join") {
    return "join";
  }
  return null;
}

function formEvent(kind: FormKind): ContactLogEvent["event"] {
  return kind === "contact" ? "contact_submission" : "join_submission";
}

function logSubmission(
  dependencies: ContactHandlerDependencies,
  kind: FormKind,
  requestId: string,
  outcome: ContactLogEvent["outcome"],
  submission?: FormSubmission,
  errorCode?: string,
): void {
  const category =
    submission?.kind === "contact" ? submission.value.category : undefined;
  dependencies.log({
    event: formEvent(kind),
    requestId,
    outcome,
    ...(category === undefined ? {} : { category }),
    ...(errorCode === undefined ? {} : { errorCode }),
  });
}

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
    ERROR_MESSAGES[error.responseCode] ??
      ERROR_MESSAGES.INVALID_REQUEST ??
      "Invalid request.",
    requestId,
    allowedOrigin,
  );
}

function validateSubmission(
  kind: FormKind,
  rawPayload: unknown,
):
  | { ok: true; submission: FormSubmission }
  | { ok: false; fields: Readonly<Record<string, string>> } {
  if (kind === "contact") {
    const validation = validateContactPayload(rawPayload);
    return validation.ok
      ? { ok: true, submission: { kind, value: validation.value } }
      : validation;
  }

  const validation = validateJoinPayload(rawPayload);
  return validation.ok
    ? { ok: true, submission: { kind, value: validation.value } }
    : validation;
}

function scheduleSlackNotification(
  submission: FormSubmission,
  requestId: string,
  context: ContactExecutionContext,
  dependencies: ContactHandlerDependencies,
): void {
  const onFailure = (error: unknown): void => {
    logSubmission(
      dependencies,
      submission.kind,
      requestId,
      "slack_failed",
      submission,
      safeErrorCode(error),
    );
  };

  if (submission.kind === "contact" && dependencies.sendSlack !== undefined) {
    const sender = dependencies.sendSlack;
    context.waitUntil(
      Promise.resolve()
        .then(() => sender(submission.value, requestId))
        .catch(onFailure),
    );
    return;
  }

  if (submission.kind === "join" && dependencies.sendJoinSlack !== undefined) {
    const sender = dependencies.sendJoinSlack;
    context.waitUntil(
      Promise.resolve()
        .then(() => sender(submission.value, requestId))
        .catch(onFailure),
    );
  }
}

export async function handleFormRequest(
  request: Request,
  context: ContactExecutionContext,
  config: ContactHandlerConfig,
  dependencies: ContactHandlerDependencies,
): Promise<Response> {
  const requestId = dependencies.createRequestId();
  const allowedOrigin = getAllowedOrigin(request, config.allowedOrigins);
  const url = new URL(request.url);
  const kind = formKindForPath(url.pathname);

  if (kind === null) {
    return errorResponse(
      404,
      "NOT_FOUND",
      "The requested endpoint does not exist.",
      requestId,
      allowedOrigin,
    );
  }

  try {
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
      ipAllowed = await dependencies.limitIp(`${kind}:${remoteIp}`);
    } catch (error) {
      logSubmission(
        dependencies,
        kind,
        requestId,
        "rate_limiter_failed",
        undefined,
        safeErrorCode(error),
      );
      return errorResponse(
        503,
        "SERVICE_UNAVAILABLE",
        "The form service is temporarily unavailable.",
        requestId,
        allowedOrigin,
      );
    }

    if (!ipAllowed) {
      logSubmission(dependencies, kind, requestId, "rate_limited");
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
      logSubmission(dependencies, kind, requestId, "honeypot_discarded");
      return successResponse(requestId, allowedOrigin);
    }

    const validation = validateSubmission(kind, rawPayload);
    if (!validation.ok) {
      logSubmission(dependencies, kind, requestId, "validation_failed");
      return errorResponse(
        400,
        "VALIDATION_FAILED",
        "Check the highlighted fields and try again.",
        requestId,
        allowedOrigin,
        validation.fields,
      );
    }
    const submission = validation.submission;

    const verification = await dependencies.verifyTurnstile({
      token: submission.value.turnstileToken,
      remoteIp,
      requestId,
      expectedAction:
        kind === "contact"
          ? config.contactTurnstileAction
          : config.joinTurnstileAction,
    });
    if (!verification.ok) {
      logSubmission(
        dependencies,
        kind,
        requestId,
        "verification_failed",
        submission,
        verification.reason.toUpperCase(),
      );
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
        `${kind}:${normalizeEmailForRateLimit(submission.value.email)}`,
      );
    } catch (error) {
      logSubmission(
        dependencies,
        kind,
        requestId,
        "rate_limiter_failed",
        submission,
        safeErrorCode(error),
      );
      return errorResponse(
        503,
        "SERVICE_UNAVAILABLE",
        "The form service is temporarily unavailable.",
        requestId,
        allowedOrigin,
      );
    }

    if (!emailAllowed) {
      logSubmission(
        dependencies,
        kind,
        requestId,
        "rate_limited",
        submission,
      );
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
      if (submission.kind === "contact") {
        await dependencies.sendEmail(
          submission.value,
          requestId,
          receivedAt,
        );
      } else {
        await dependencies.sendJoinEmail(
          submission.value,
          requestId,
          receivedAt,
        );
      }
    } catch (error) {
      logSubmission(
        dependencies,
        kind,
        requestId,
        "delivery_failed",
        submission,
        safeErrorCode(error),
      );
      return errorResponse(
        503,
        "DELIVERY_UNAVAILABLE",
        "The submission could not be delivered. Try again later.",
        requestId,
        allowedOrigin,
        undefined,
        60,
      );
    }

    scheduleSlackNotification(submission, requestId, context, dependencies);
    logSubmission(dependencies, kind, requestId, "accepted", submission);
    return successResponse(requestId, allowedOrigin);
  } catch (error) {
    logSubmission(
      dependencies,
      kind,
      requestId,
      "internal_error",
      undefined,
      safeErrorCode(error),
    );
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "The form service is temporarily unavailable.",
      requestId,
      allowedOrigin,
    );
  }
}

/** Retained for existing imports while the Worker now serves both form routes. */
export const handleContactRequest = handleFormRequest;

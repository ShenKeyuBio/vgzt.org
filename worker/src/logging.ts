export type ContactOutcome =
  | "accepted"
  | "delivery_failed"
  | "honeypot_discarded"
  | "internal_error"
  | "rate_limited"
  | "rate_limiter_failed"
  | "slack_failed"
  | "validation_failed"
  | "verification_failed";

export interface ContactLogEvent {
  event: "contact_submission";
  requestId: string;
  outcome: ContactOutcome;
  category?: string;
  errorCode?: string;
}

export type ContactLogger = (event: ContactLogEvent) => void;

export const structuredLogger: ContactLogger = (event) => {
  console.log(JSON.stringify(event));
};

export function safeErrorCode(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return "UNKNOWN";
  }

  const code = Reflect.get(error, "code");
  if (typeof code === "string" && /^[A-Z0-9_-]{1,64}$/u.test(code)) {
    return code;
  }

  const name = Reflect.get(error, "name");
  if (typeof name === "string" && /^[A-Za-z0-9_-]{1,64}$/u.test(name)) {
    return name;
  }

  return "UNKNOWN";
}

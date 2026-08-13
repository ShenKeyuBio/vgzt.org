const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileResponse {
  success: boolean;
  hostname?: string;
  action?: string;
}

export interface TurnstileVerificationInput {
  token: string;
  remoteIp: string;
  requestId: string;
}

export interface TurnstileVerifierOptions {
  secret: string;
  expectedHostnames: ReadonlySet<string>;
  expectedAction: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

export type TurnstileVerificationResult =
  | { ok: true }
  | { ok: false; reason: "provider" | "token" | "hostname" | "action" };

function parseTurnstileResponse(value: unknown): TurnstileResponse | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const success = Reflect.get(value, "success");
  if (typeof success !== "boolean") {
    return null;
  }

  const hostname = Reflect.get(value, "hostname");
  const action = Reflect.get(value, "action");
  return {
    success,
    ...(typeof hostname === "string" ? { hostname } : {}),
    ...(typeof action === "string" ? { action } : {}),
  };
}

export async function verifyTurnstile(
  input: TurnstileVerificationInput,
  options: TurnstileVerifierOptions,
): Promise<TurnstileVerificationResult> {
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 5_000);
  const body = new URLSearchParams({
    secret: options.secret,
    response: input.token,
    remoteip: input.remoteIp,
    idempotency_key: input.requestId,
  });

  try {
    const response = await fetcher(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, reason: "provider" };
    }

    const rawResult: unknown = await response.json();
    const result = parseTurnstileResponse(rawResult);
    if (result === null || !result.success) {
      return { ok: false, reason: "token" };
    }

    if (
      result.hostname === undefined ||
      !options.expectedHostnames.has(result.hostname)
    ) {
      return { ok: false, reason: "hostname" };
    }

    if (result.action !== options.expectedAction) {
      return { ok: false, reason: "action" };
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: "provider" };
  } finally {
    clearTimeout(timeoutId);
  }
}

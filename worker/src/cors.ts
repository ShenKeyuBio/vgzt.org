const ALLOWED_REQUEST_HEADERS = new Set(["content-type"]);

export function parseCsvSet(value: string): ReadonlySet<string> {
  return new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );
}

export function getAllowedOrigin(
  request: Request,
  allowedOrigins: ReadonlySet<string>,
): string | null {
  const origin = request.headers.get("origin");
  return origin !== null && allowedOrigins.has(origin) ? origin : null;
}

export function isValidPreflight(request: Request): boolean {
  const requestedMethod = request.headers.get("access-control-request-method");
  if (requestedMethod !== null && requestedMethod.toUpperCase() !== "POST") {
    return false;
  }

  const requestedHeaders = request.headers.get("access-control-request-headers");
  if (requestedHeaders === null || requestedHeaders.trim().length === 0) {
    return true;
  }

  return requestedHeaders
    .split(",")
    .map((header) => header.trim().toLowerCase())
    .every((header) => ALLOWED_REQUEST_HEADERS.has(header));
}

export function applyApiHeaders(headers: Headers, allowedOrigin: string | null): void {
  headers.set("cache-control", "no-store");
  headers.set("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
  headers.set("referrer-policy", "no-referrer");
  headers.set("vary", "Origin");
  headers.set("x-content-type-options", "nosniff");

  if (allowedOrigin === null) {
    return;
  }

  headers.set("access-control-allow-origin", allowedOrigin);
  headers.set("access-control-expose-headers", "Retry-After, X-Request-Id");
}

export function createPreflightResponse(allowedOrigin: string): Response {
  const headers = new Headers();
  applyApiHeaders(headers, allowedOrigin);
  headers.set("access-control-allow-methods", "POST, OPTIONS");
  headers.set("access-control-allow-headers", "Content-Type");
  headers.set("access-control-max-age", "86400");
  return new Response(null, { status: 204, headers });
}

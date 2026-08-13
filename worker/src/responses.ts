import { applyApiHeaders } from "./cors";

export interface ApiErrorBody {
  ok: false;
  code: string;
  message: string;
  requestId: string;
  fields?: Readonly<Record<string, string>>;
}

export interface ApiSuccessBody {
  ok: true;
  requestId: string;
}

interface JsonResponseOptions {
  status: number;
  requestId: string;
  allowedOrigin: string | null;
  retryAfter?: number;
}

export function jsonResponse(
  body: ApiErrorBody | ApiSuccessBody,
  options: JsonResponseOptions,
): Response {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "x-request-id": options.requestId,
  });
  applyApiHeaders(headers, options.allowedOrigin);
  if (options.retryAfter !== undefined) {
    headers.set("retry-after", String(options.retryAfter));
  }

  return Response.json(body, { status: options.status, headers });
}

export function successResponse(
  requestId: string,
  allowedOrigin: string,
): Response {
  return jsonResponse(
    { ok: true, requestId },
    { status: 200, requestId, allowedOrigin },
  );
}

export const MAX_CONTACT_BODY_BYTES = 32 * 1_024;

export class RequestBodyError extends Error {
  readonly status: 400 | 413 | 415;
  readonly responseCode:
    | "INVALID_REQUEST"
    | "PAYLOAD_TOO_LARGE"
    | "UNSUPPORTED_MEDIA_TYPE";

  constructor(
    status: 400 | 413 | 415,
    responseCode:
      | "INVALID_REQUEST"
      | "PAYLOAD_TOO_LARGE"
      | "UNSUPPORTED_MEDIA_TYPE",
  ) {
    super(responseCode);
    this.name = "RequestBodyError";
    this.status = status;
    this.responseCode = responseCode;
  }
}

function validateRequestMetadata(request: Request, maxBytes: number): void {
  const contentType = request.headers.get("content-type");
  const mediaType = contentType?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    throw new RequestBodyError(415, "UNSUPPORTED_MEDIA_TYPE");
  }

  const contentEncoding = request.headers.get("content-encoding");
  if (
    contentEncoding !== null &&
    contentEncoding.trim().toLowerCase() !== "identity"
  ) {
    throw new RequestBodyError(415, "UNSUPPORTED_MEDIA_TYPE");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength === null) {
    return;
  }

  if (!/^\d+$/u.test(contentLength.trim())) {
    throw new RequestBodyError(400, "INVALID_REQUEST");
  }

  if (Number(contentLength) > maxBytes) {
    throw new RequestBodyError(413, "PAYLOAD_TOO_LARGE");
  }
}

async function readBytesWithLimit(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array> {
  if (request.body === null) {
    throw new RequestBodyError(400, "INVALID_REQUEST");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        break;
      }

      totalBytes += result.value.byteLength;
      if (totalBytes > maxBytes) {
        try {
          await reader.cancel("Contact request body exceeded its byte limit.");
        } catch {
          // Preserve the intended 413 response even if stream cancellation fails.
        }
        throw new RequestBodyError(413, "PAYLOAD_TOO_LARGE");
      }

      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
}

export async function readJsonBodyLimited(
  request: Request,
  maxBytes = MAX_CONTACT_BODY_BYTES,
): Promise<unknown> {
  validateRequestMetadata(request, maxBytes);
  const bytes = await readBytesWithLimit(request, maxBytes);

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(
      bytes,
    );
  } catch {
    throw new RequestBodyError(400, "INVALID_REQUEST");
  }

  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    throw new RequestBodyError(400, "INVALID_REQUEST");
  }
}

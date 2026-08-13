export async function digestRateLimitKey(
  namespace: string,
  identifier: string,
): Promise<string> {
  const input = new TextEncoder().encode(`${namespace}\u0000${identifier}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

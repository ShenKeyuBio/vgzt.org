import { describe, expect, it } from "vitest";

import { verifyTurnstile } from "../src/turnstile";

function jsonFetcher(
  payload: unknown,
  inspect?: (input: RequestInfo | URL, init?: RequestInit) => void,
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    inspect?.(input, init);
    return Response.json(payload);
  };
}

const input = {
  token: "turnstile-token",
  remoteIp: "203.0.113.10",
  requestId: "00000000-0000-4000-8000-000000000001",
};

describe("Turnstile server verification", () => {
  it("requires success, an allowed hostname, and the VGZT contact action", async () => {
    let requestBody = "";
    const result = await verifyTurnstile(input, {
      secret: "server-secret",
      expectedHostnames: new Set(["vgzt.org", "www.vgzt.org"]),
      expectedAction: "vgzt_contact",
      fetcher: jsonFetcher(
        { success: true, hostname: "vgzt.org", action: "vgzt_contact" },
        (_url, init) => {
          requestBody = String(init?.body ?? "");
        },
      ),
    });

    expect(result).toEqual({ ok: true });
    const parameters = new URLSearchParams(requestBody);
    expect(parameters.get("secret")).toBe("server-secret");
    expect(parameters.get("response")).toBe("turnstile-token");
    expect(parameters.get("remoteip")).toBe("203.0.113.10");
    expect(parameters.get("idempotency_key")).toBe(input.requestId);
  });

  it("rejects a token issued on another hostname", async () => {
    const result = await verifyTurnstile(input, {
      secret: "server-secret",
      expectedHostnames: new Set(["vgzt.org"]),
      expectedAction: "vgzt_contact",
      fetcher: jsonFetcher({
        success: true,
        hostname: "attacker.test",
        action: "vgzt_contact",
      }),
    });

    expect(result).toEqual({ ok: false, reason: "hostname" });
  });

  it("rejects an otherwise valid token for another action", async () => {
    const result = await verifyTurnstile(input, {
      secret: "server-secret",
      expectedHostnames: new Set(["vgzt.org"]),
      expectedAction: "vgzt_contact",
      fetcher: jsonFetcher({
        success: true,
        hostname: "vgzt.org",
        action: "login",
      }),
    });

    expect(result).toEqual({ ok: false, reason: "action" });
  });

  it("fails closed on a provider error", async () => {
    const fetcher: typeof fetch = async () => {
      throw new Error("network failure");
    };
    const result = await verifyTurnstile(input, {
      secret: "server-secret",
      expectedHostnames: new Set(["vgzt.org"]),
      expectedAction: "vgzt_contact",
      fetcher,
    });

    expect(result).toEqual({ ok: false, reason: "provider" });
  });
});

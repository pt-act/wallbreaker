import { afterEach, describe, expect, it, vi } from "vitest";

// EF-3 follow-up (2026-11-10): the per-launch dashboard token rotates on every
// `wallbreaker dashboard` restart, so a tab that booted against the previous
// token must recover — j() sees the 401, reauth() re-learns the token from the
// exempt /api/session bootstrap, and the request is retried once. This pins that
// recovery path (jsdom cannot exercise the real ASGI middleware).
//
// NOTE: auth.ts skips its module-level bootstrap when NODE_ENV=test; this test
// drives the flow manually with a URL-routed fetch stub.
type FetchLike = { ok: boolean; status: number; statusText: string; json: () => Promise<unknown> };

describe("dashboard auth: bootstrap + 401 reauth retry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("re-learns a rotated token on 401 and retries once", async () => {
    const seen: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<FetchLike> => {
      const url = String(input);
      const headerToken = new Headers(init?.headers).get("x-wb-token") ?? "";
      seen.push(`${url} token=${headerToken || "-"}`);
      if (url === "/api/session") {
        return {
          ok: true, status: 200, statusText: "OK",
          json: async () => ({ authenticated: true, tokenHeader: "x-wb-token", token: "tok-2" }),
        };
      }
      if (headerToken !== "tok-2") {
        return {
          ok: false, status: 401, statusText: "Unauthorized",
          json: async () => ({ detail: "missing or invalid dashboard token" }),
        };
      }
      return { ok: true, status: 200, statusText: "OK", json: async () => ({ has_target: true }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { api } = await import("../api");
    const cfg = await api.config();

    expect(cfg.has_target).toBe(true);
    // No token yet (fresh page, rotated server): plain request → 401,
    // then /api/session, then the retry carries the new token.
    expect(seen[0]).toBe("/api/config token=-");
    expect(seen[1]).toBe("/api/session token=-");
    expect(seen[2]).toBe("/api/config token=tok-2");
    expect(seen).toHaveLength(3); // exactly one retry, no loops
    expect(localStorage.getItem("wallbreaker.dashboardToken")).toBe("tok-2");
  });
});

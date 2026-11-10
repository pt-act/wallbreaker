// Dashboard auth bootstrap (server side: dashboard/auth.py).
//
// The server generates a per-launch bearer token and requires it — header
// `x-wb-token` (or `Authorization: Bearer`) — on every /api/* route except
// /api/health and /api/session. /api/session is the same-origin bootstrap the
// SPA uses to LEARN the token: the server hands it to loopback origins only.
// Without this bootstrap every /api call 401s ("missing or invalid dashboard
// token") while the shell still renders — the deployed regression recorded as
// EF-3 in the memory bank (2026-11-10).
const TOKEN_KEY = "wallbreaker.dashboardToken";

let token: string | null = null;
try { token = localStorage.getItem(TOKEN_KEY); } catch { /* storage unavailable */ }

export async function bootstrapAuth(): Promise<void> {
  try {
    const r = await fetch("/api/session");
    if (!r.ok) return;
    const d = (await r.json()) as { token?: string };
    if (d.token) {
      token = d.token;
      try { localStorage.setItem(TOKEN_KEY, d.token); } catch { /* storage unavailable */ }
    }
  } catch {
    // Server unreachable — let the real requests surface their own errors.
  }
}

/** Attach the dashboard token to an outgoing /api request (merges with caller headers). */
export function authInit(init?: RequestInit): RequestInit {
  if (!token) return init ?? {};
  const headers = new Headers(init?.headers);
  headers.set("x-wb-token", token);
  return { ...init, headers };
}

/** Re-learn the token after a 401 (a server restart rotates it) and retry the caller. */
export async function reauth(): Promise<void> {
  token = null;
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
  await bootstrapAuth();
}

// Kick off the bootstrap once, at module load (main.tsx imports both api
// modules, so this runs for / and /v2 alike). Skipped under vitest, where
// fetch is mocked and an extra startup call would pollute call-count asserts.
if (typeof process === "undefined" || process.env?.NODE_ENV !== "test") {
  void bootstrapAuth();
}

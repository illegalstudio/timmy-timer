/** Where the pop-up goes to sign in again; Access sends it back here. */
export const SESSION_URL = "/api/session";

/**
 * Cloudflare Access answers a request from an expired session with a
 * redirect to its own login page. Followed by fetch, that cross-origin
 * redirect only surfaces as an opaque "Failed to fetch", so redirects are
 * caught here and turned into this error instead.
 */
export class SessionExpiredError extends Error {
  constructor() {
    super("The session has expired");
    this.name = "SessionExpiredError";
  }
}

export async function apiFetch(input: string, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    credentials: "same-origin",
    redirect: "manual",
  });
  if (response.type === "opaqueredirect" || response.status === 401)
    throw new SessionExpiredError();
  return response;
}

export type SessionState = "active" | "expired" | "unreachable";

export async function checkSession(): Promise<SessionState> {
  try {
    const response = await apiFetch(SESSION_URL, { cache: "no-store" });
    return response.ok ? "active" : "unreachable";
  } catch (failure) {
    return failure instanceof SessionExpiredError ? "expired" : "unreachable";
  }
}

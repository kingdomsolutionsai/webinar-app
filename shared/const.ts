export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// One-time nonce cookie that binds an OAuth login to the browser that started
// it. The `__Host-` prefix forces the cookie host-only (Secure, Path=/, no
// Domain), so a sibling *.manus.space site cannot plant a matching value in a
// victim's browser.
export const OAUTH_STATE_COOKIE = "__Host-oauth_state";

// `state` carries the callback redirect URI (used at token exchange) plus the
// CSRF nonce. Defined here so the client encoder and server decoder never drift.
// `returnTo` remembers the in-app path the person started from, so signing in at
// /dashboard returns to /dashboard rather than dropping them on the front page.
export type OAuthState = { redirectUri: string; nonce?: string; returnTo?: string };

/**
 * Reduces an arbitrary value to a safe in-app path.
 *
 * `returnTo` travels through a URL the user can edit, so it must never be
 * trusted as a destination. Anything that is not a plain, single-slash-rooted
 * path collapses to "/". That rejects absolute URLs ("https://evil.test"),
 * scheme-relative ones ("//evil.test") and backslash tricks ("/\\evil.test"),
 * which is what turns a convenience redirect into an open redirect — a phishing
 * link that genuinely begins on our domain before landing elsewhere.
 */
export const sanitizeReturnTo = (value: unknown): string => {
  if (typeof value !== "string") return "/";
  const path = value.trim();
  if (!path.startsWith("/")) return "/";
  if (path.startsWith("//") || path.startsWith("/\\")) return "/";
  if (path.includes("\\") || /[\r\n]/.test(path)) return "/";
  // Never bounce back into the auth machinery itself.
  if (path.startsWith("/api/")) return "/";
  return path;
};

export const encodeOAuthState = (state: OAuthState): string =>
  btoa(JSON.stringify(state));

export const decodeOAuthState = (state: string): OAuthState => {
  let decoded: string;
  try {
    decoded = atob(state);
  } catch {
    // Malformed base64 (e.g. attacker-supplied garbage). Return no nonce so the
    // callback's CSRF guard rejects it with 403 — never throw, since the caller
    // runs outside the request handler's try/catch.
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") {
      return { ...parsed, returnTo: sanitizeReturnTo(parsed.returnTo) };
    }
  } catch {
    // Legacy links: `state` was a bare base64(redirectUri) with no nonce.
  }
  return { redirectUri: decoded, returnTo: "/" };
};

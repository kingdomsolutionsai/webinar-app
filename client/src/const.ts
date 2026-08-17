export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Start login. Replaces the Manus OAuth portal redirect with the app's own
// single-admin login page. Sends the person to /login, preserving where they
// were so they can be returned there after signing in.
export const startLogin = () => {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  window.location.href = "/login";
};

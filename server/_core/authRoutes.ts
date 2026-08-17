// Login/logout routes for the single-admin dashboard.
// A tiny server-rendered login page keeps the React client untouched: it posts
// to /api/login, we set the session cookie, then redirect to /dashboard.

import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { verifyAdminLogin } from "./auth";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function loginPage(error?: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in · Kingdom Solutions AI</title>
<style>
  :root{--gold:#C9A227;--ink:#0B0B0B;--cream:#FBF7EF}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--ink);
    color:var(--cream);font-family:Georgia,'Times New Roman',serif}
  .card{width:min(92vw,380px);background:#141414;border:1px solid #2a2a2a;border-radius:14px;
    padding:2rem 1.75rem;box-shadow:0 12px 40px rgba(0,0,0,.5)}
  h1{font-size:1.4rem;margin:0 0 .25rem;color:#fff}
  p.sub{margin:0 0 1.5rem;color:#9a9a9a;font-size:.9rem}
  label{display:block;font-size:.8rem;letter-spacing:.03em;text-transform:uppercase;
    color:#b9b9b9;margin:1rem 0 .4rem}
  input{width:100%;padding:.7rem .8rem;border-radius:8px;border:1px solid #333;background:#0e0e0e;
    color:#fff;font-size:1rem;font-family:inherit}
  button{width:100%;margin-top:1.5rem;padding:.8rem;border:0;border-radius:8px;background:var(--gold);
    color:#0b0b0b;font-weight:700;font-size:1rem;letter-spacing:.03em;cursor:pointer}
  .err{background:#3a1414;border:1px solid #5c1f1f;color:#f3b7b7;padding:.6rem .8rem;border-radius:8px;
    font-size:.85rem;margin-bottom:1rem}
</style></head><body>
<form class="card" method="POST" action="/api/login">
  <h1>Owner Dashboard</h1>
  <p class="sub">Kingdom Solutions AI™ · Webinar</p>
  ${error ? `<div class="err">${error}</div>` : ""}
  <label for="email">Email</label>
  <input id="email" name="email" type="email" autocomplete="username" required autofocus>
  <label for="password">Password</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required>
  <button type="submit">Sign in</button>
</form></body></html>`;
}

export function registerAuthRoutes(app: Express) {
  app.get("/login", (_req: Request, res: Response) => {
    res.status(200).type("html").send(loginPage());
  });

  app.post("/api/login", async (req: Request, res: Response) => {
    const email = String(req.body?.email ?? "");
    const password = String(req.body?.password ?? "");

    const openId = await verifyAdminLogin(email, password);
    if (!openId) {
      return res.status(401).type("html").send(loginPage("Email or password is incorrect."));
    }

    const token = await sdk.createSessionToken(openId, {
      name: "Tabitha Rector",
      expiresInMs: ONE_YEAR_MS,
    });
    res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
    return res.redirect(302, "/dashboard");
  });

  app.get("/logout", (req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(req) });
    return res.redirect(302, "/login");
  });
}

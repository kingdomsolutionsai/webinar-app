import { describe, expect, it } from "vitest";

/**
 * Validates the BREVO_API_KEY against Brevo's lightest authenticated endpoint
 * (`GET /v3/account`). This is a real network call on purpose: a key that looks
 * well-formed but is revoked, scoped wrongly, or from the wrong account would
 * otherwise fail silently at the first real signup.
 *
 * It also reports whether the intended sender address is verified, because Brevo
 * rejects sends from unverified senders even when the key itself is valid.
 */
const SENDER = "tabitha@kingdomsolutionsai.com";

describe("Brevo credentials", () => {
  it("authenticates against the Brevo account endpoint", async () => {
    const key = process.env.BREVO_API_KEY;
    expect(key, "BREVO_API_KEY is not set in the environment").toBeTruthy();

    const response = await fetch("https://api.brevo.com/v3/account", {
      headers: { "api-key": key as string, accept: "application/json" },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Brevo rejected the API key (HTTP ${response.status}). Response: ${body.slice(0, 300)}`,
      );
    }

    const account = (await response.json()) as {
      email?: string;
      companyName?: string;
      plan?: unknown;
    };

    // A valid account response always carries the account email.
    expect(account.email, "Brevo returned no account email").toBeTruthy();
    console.log(
      `[Brevo] Authenticated as ${account.email}${
        account.companyName ? ` (${account.companyName})` : ""
      }`,
    );
  }, 20000);

  it("reports whether the intended sender address is verified", async () => {
    const key = process.env.BREVO_API_KEY;
    expect(key).toBeTruthy();

    const response = await fetch("https://api.brevo.com/v3/senders", {
      headers: { "api-key": key as string, accept: "application/json" },
    });
    expect(response.ok, `Could not list senders (HTTP ${response.status})`).toBe(true);

    const data = (await response.json()) as {
      senders?: { email: string; active: boolean; name?: string }[];
    };
    const senders = data.senders ?? [];
    const match = senders.find(s => s.email.toLowerCase() === SENDER);

    // Surfaced as a log rather than a hard failure: the key is valid either way,
    // and sender verification is an action only Tabitha can complete in Brevo.
    if (!match) {
      console.warn(
        `[Brevo] WARNING: ${SENDER} is not among the account senders ` +
          `(${senders.map(s => s.email).join(", ") || "none found"}). ` +
          `Sends from this address will be rejected until it is added and verified.`,
      );
    } else if (!match.active) {
      console.warn(`[Brevo] WARNING: ${SENDER} exists but is not yet verified/active.`);
    } else {
      console.log(`[Brevo] Sender ${SENDER} is verified and active.`);
    }

    expect(Array.isArray(senders)).toBe(true);
  }, 20000);
});

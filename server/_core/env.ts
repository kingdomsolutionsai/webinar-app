export const ENV = {
  // --- Active configuration (self-contained, no Manus) ---
  // Session signing secret (JWT). Never depended on Manus.
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",

  // Single-admin login (replaces Manus OAuth).
  adminEmail: (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase(),
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH ?? "",

  // Shared secret the Render Cron Job presents to trigger the sequence dispatch.
  cronSecret: process.env.CRON_SECRET ?? "",

  // Public origin of the deployed site (used to build email links).
  publicUrl: process.env.PUBLIC_URL ?? "",

  // Email provider (unchanged).
  brevoApiKey: process.env.BREVO_API_KEY ?? "",

  // The account treated as owner/admin in db.ts. Same as the admin login email.
  ownerOpenId: (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase(),

  // --- Legacy Manus platform fields ---
  // Retained ONLY so residual _core utilities (llm/map/dataApi/notification/
  // systemRouter) still compile. They default to "" and are not used by the
  // webinar registration flow. Safe to delete once those utilities are pruned.
  appId: process.env.VITE_APP_ID ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

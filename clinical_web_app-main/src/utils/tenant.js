// src/utils/tenant.js
// Per-clinic subdomain branding: when a clinic opens the app from its own
// <slug>.yourapp.com, the login page greets them by name instead of the
// generic "Clinic Management" wordmark. This is display-only — it never
// changes what a login is allowed to do; the account's clinic_id (set at
// login, carried in the JWT) is still the only real tenant boundary.
//
// Inert by design until VITE_APP_ROOT_DOMAIN is set at build time (see
// .env.example) and a real wildcard domain is wired up in Vercel + DNS —
// until then this always returns null and the login page looks as it does
// today, on any *.vercel.app or plain-domain deployment.

const ROOT_DOMAIN = import.meta.env.VITE_APP_ROOT_DOMAIN;
const RESERVED_LABELS = new Set(["www", "app", "api"]);

/**
 * Returns the clinic slug encoded in the current hostname's subdomain, or
 * null if there isn't one (no root domain configured, apex domain, "www",
 * localhost, a *.vercel.app preview URL, etc).
 *
 * `rootDomain` defaults to the build-time env var — tests pass one directly
 * instead of stubbing import.meta.env.
 */
export const getSubdomainSlug = (hostname = window.location.hostname, rootDomain = ROOT_DOMAIN) => {
  if (!rootDomain || !hostname.endsWith(`.${rootDomain}`)) return null;

  const prefix = hostname.slice(0, -(rootDomain.length + 1));
  // A prefix with a dot in it (e.g. "staging.greenvalley") isn't a single
  // clinic slug — bail rather than guess.
  if (!prefix || prefix.includes(".") || RESERVED_LABELS.has(prefix)) return null;

  return prefix;
};

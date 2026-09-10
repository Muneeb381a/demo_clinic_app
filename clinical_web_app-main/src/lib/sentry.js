// Sentry for the browser. No-op unless VITE_SENTRY_DSN is set at build time,
// so local dev and DSN-less builds are unaffected.

import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;

export const initSentry = () => {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0),
    // Don't send request bodies / PII by default (this is clinical data).
    sendDefaultPii: false,
  });
};

export { Sentry };

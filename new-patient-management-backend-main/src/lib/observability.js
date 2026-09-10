// src/lib/observability.js
// Sentry wiring. Entirely inert unless SENTRY_DSN is set, so local dev and any
// environment without a DSN behave exactly as before.

import * as Sentry from "@sentry/node";
import { logger } from "./logger.js";

const dsn = process.env.SENTRY_DSN;
export const sentryEnabled = Boolean(dsn);

export const initSentry = () => {
  if (!sentryEnabled) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    sendDefaultPii: false,
  });
  logger.info("Sentry initialised", { environment: process.env.NODE_ENV });
};

// Report a server-side error, tagging it with the request id and user when known.
export const captureError = (err, req) => {
  if (!sentryEnabled) return;
  Sentry.withScope((scope) => {
    if (req?.id) scope.setTag("request_id", req.id);
    if (req?.user?.id) scope.setUser({ id: String(req.user.id) });
    if (req) scope.setContext("request", { method: req.method, path: req.originalUrl });
    Sentry.captureException(err);
  });
};

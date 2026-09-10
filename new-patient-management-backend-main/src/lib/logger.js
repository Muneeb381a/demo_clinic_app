// src/lib/logger.js
// Dependency-free structured logger. JSON lines in production (one object per
// line, ready for any log aggregator), human-readable in dev.
//
//   logger.info("patient created", { patientId: 12 });
//   const log = logger.child({ reqId });   // request-scoped bindings
//   log.error("save failed", { error: err.message });

import { inspect } from "util";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const THRESHOLD = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;
const isProd = process.env.NODE_ENV === "production";

const write = (level, bindings, message, context = {}) => {
  if (LEVELS[level] < THRESHOLD) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    ...bindings,
    ...context,
  };
  if (context?.error?.stack && !isProd) entry.stack = context.error.stack;

  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;

  if (isProd) {
    sink(JSON.stringify(entry));
  } else {
    const extra = { ...bindings, ...context };
    sink(
      `${entry.timestamp} [${entry.level}] ${message}` +
        (Object.keys(extra).length ? " " + inspect(extra, { colors: true, depth: 4 }) : "")
    );
  }
};

const make = (bindings = {}) => ({
  debug: (msg, ctx) => write("debug", bindings, msg, ctx),
  info: (msg, ctx) => write("info", bindings, msg, ctx),
  warn: (msg, ctx) => write("warn", bindings, msg, ctx),
  error: (msg, ctx) => write("error", bindings, msg, ctx),
  child: (extra) => make({ ...bindings, ...extra }),
});

export const logger = make();

// src/middleware/requestContext.js
// Gives every request a stable id (honouring an inbound x-request-id from a
// proxy/gateway) and a request-scoped child logger at req.log. The id goes
// back on the response and into error payloads so a user-reported failure can
// be traced to exact log lines.

import { randomUUID } from "crypto";
import { logger } from "../lib/logger.js";

export const requestContext = (req, res, next) => {
  const inbound = req.headers["x-request-id"];
  req.id = (typeof inbound === "string" && inbound.length <= 100 ? inbound : null) || randomUUID();
  res.setHeader("x-request-id", req.id);
  req.log = logger.child({ reqId: req.id });

  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    req.log.info("request", {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(ms),
    });
  });

  next();
};

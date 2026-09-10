// src/index.js — local / long-running server entrypoint.
// On Vercel the platform imports ./app.js directly; this file only runs for
// `npm run dev` / `npm start`. All middleware, routes, health checks and the
// error handler live in app.js.

import dotenv from "dotenv";
import app from "./app.js";
import { pool, closeDB } from "./models/db.js";
import { logger } from "./lib/logger.js";

dotenv.config();

const port = parseInt(process.env.PORT || "4500", 10);
if (Number.isNaN(port)) throw new Error("Invalid PORT configuration");

const server = app.listen(port, () => {
  logger.info("server started", {
    port,
    env: process.env.NODE_ENV || "development",
    pid: process.pid,
  });
});

const shutdown = async (signal) => {
  logger.info("shutting down", { signal });
  try {
    await Promise.all([
      new Promise((resolve) => server.close(resolve)),
      closeDB(),
    ]);
    logger.info("clean shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error("shutdown failed", { error: err.message });
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { server, pool };

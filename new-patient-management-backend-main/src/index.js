import fs from "fs/promises";
import { pool, closeDB, ensureIndexes } from "./models/db.js";
import app from "./app.js";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import { v4 as uuidv4 } from "uuid";
import responseTime from "response-time";

// Enhanced Logger with Request IDs
const logger = {
  info: (message, context = {}) => 
    console.log(JSON.stringify({ level: "INFO", timestamp: new Date().toISOString(), ...context, message })),
  warn: (message, context = {}) => 
    console.warn(JSON.stringify({ level: "WARN", timestamp: new Date().toISOString(), ...context, message })),
  error: (message, context = {}) => 
    console.error(JSON.stringify({ level: "ERROR", timestamp: new Date().toISOString(), ...context, message })),
};

// Configuration with Validation
const config = (() => {
  const port = parseInt(process.env.PORT || "4500", 10);
  if (isNaN(port)) throw new Error("Invalid PORT configuration");
  
  return {
    server: {
      port,
      timeout: 30000,
      env: process.env.NODE_ENV || "development",
      cluster: process.env.CLUSTER_MODE === "true",
    },
    security: {
      cors: {
        allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") || [],
        maxAge: 86400,
      },
    },
    database: {
      maxRetries: parseInt(process.env.DB_MAX_RETRIES || "5", 10),
      retryDelay: parseInt(process.env.DB_RETRY_DELAY || "2000", 10),
    },
  };
})();

// Request Context Middleware
const requestContext = (req, res, next) => {
  req.context = {
    requestId: uuidv4(),
    startTime: process.hrtime.bigint(),
  };
  res.setHeader("X-Request-ID", req.context.requestId);
  next();
};

// Enhanced Security Headers
const securityHeaders = [
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    frameguard: { action: "deny" },
  }),
  (req, res, next) => {
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=()");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    next();
  },
];

// Performance Monitoring
app.use(responseTime((req, res, time) => {
  logger.info("Request processed", {
    method: req.method,
    path: req.path,
    status: res.statusCode,
    duration: time.toFixed(2),
    requestId: req.context.requestId,
  });
}));

// Enhanced CORS Configuration
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || config.security.cors.allowedOrigins.some(allowed => 
      new RegExp(allowed.replace(/\./g, "\\.").replace(/\*/g, ".*")).test(origin)
    )) {
      callback(null, true);
    } else {
      logger.warn("CORS violation attempt", { origin });
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
  maxAge: config.security.cors.maxAge,
  credentials: true,
};

// Cluster Mode Support
const startCluster = () => {
  if (config.server.cluster && cluster.isPrimary) {
    logger.info(`Master ${process.pid} is running`);
    const numWorkers = os.cpus().length;
    
    for (let i = 0; i < numWorkers; i++) {
      cluster.fork();
    }
    
    cluster.on("exit", (worker) => {
      logger.warn(`Worker ${worker.process.pid} died`);
      cluster.fork();
    });
  } else {
    startServer();
  }
};

// Enhanced Server Startup
const startServer = async () => {
  try {
    dotenv.config();

    // Enhanced Health Check with DB Status
    app.get("/health", async (req, res) => {
      try {
        await pool.query("SELECT 1");
        res.json({
          status: "OK",
          db: "connected",
          uptime: process.uptime(),
        });
      } catch (dbError) {
        res.status(503).json({
          status: "DB_ERROR",
          error: dbError.message,
        });
      }
    });
    
    // Ensure DB indexes exist (no-op if already created)
    await ensureIndexes();

    const server = app.listen(config.server.port, () => {
      logger.info(`Server started in ${config.server.env} mode`, {
        port: config.server.port,
        pid: process.pid,
      });
    });
    
    // Enhanced Graceful Shutdown
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down`);
      try {
        await Promise.all([
          new Promise((resolve) => server.close(resolve)),
          closeDB(),
        ]);
        logger.info("Clean shutdown complete");
        process.exit(0);
      } catch (shutdownError) {
        logger.error("Shutdown failed", { error: shutdownError });
        process.exit(1);
      }
    };
    
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
    
  } catch (startupError) {
    logger.error("Critical startup failure", {
      error: startupError.message,
      stack: startupError.stack,
    });
    process.exit(1);
  }
};

// Start in cluster mode if configured
if (config.server.cluster) {
  import("cluster").then(({ default: cluster }) => {
    import("os").then(({ default: os }) => startCluster());
  });
} else {
  startServer();
}
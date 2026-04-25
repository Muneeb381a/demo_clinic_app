import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { pool, closeDB } from "./models/db.js";
import { ApiError } from "./utils/ApiError.js";
import { asyncHandler } from "./utils/asyncHandler.js";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { logger } from "../logger.js";

// Load environment variables first
dotenv.config();

const app = express();

// Validated configuration
const config = {
  server: {
    port: parseInt(process.env.PORT, 10) || 4500,
    env: process.env.NODE_ENV || "development",
    requestLimit: "200kb", // Increased for batch consultation endpoint
    trustProxy: process.env.TRUST_PROXY === "true"
  },
  security: {
    cors: {
      allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") || [
        "https://demo-clinic-app-dp7h.vercel.app",
        "https://clinical-web-app.vercel.app",
        "http://localhost:5173",
        "http://localhost:5174"
      ]
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 500
    }
  }
};

// Gzip compression — reduces response payload size ~70% for JSON
app.use(compression());

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  }
}));

// Trust proxy
if (config.server.trustProxy) {
  app.set('trust proxy', 1);
}

// CORS — allow localhost, any *.vercel.app subdomain, plus custom origins from env
const originAllowed = (origin) => {
  if (!origin) return true;
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  if (/^https:\/\/[^.]+\.vercel\.app$/.test(origin)) return true;
  return config.security.cors.allowedOrigins.some((pattern) =>
    new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$").test(origin)
  );
};

app.use(cors({
  origin: (origin, callback) =>
    originAllowed(origin) ? callback(null, true) : callback(new Error("Not allowed by CORS")),
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 204
}));

// Request logging
if (config.server.env !== "test") {
  app.use(morgan(config.server.env === "development" ? "dev" : "combined", {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Rate limiting
app.use(rateLimit({
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.max,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many requests, please try again later"
    });
  }
}));

// Body parsing with security
app.use(express.json({
  limit: config.server.requestLimit,
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf.toString());
    } catch (e) {
      throw new ApiError(400, "Invalid JSON payload");
    }
  }
}));

app.use(express.urlencoded({
  extended: true,
  limit: config.server.requestLimit
}));

// Enhanced health check with PostgreSQL
app.get("/health", asyncHandler(async (req, res) => {
  let dbStatus = "disconnected";
  let dbLatency = 0;

  try {
    const start = process.hrtime();
    await pool.query("SELECT 1");
    const latency = process.hrtime(start);

    dbStatus = "connected";
    dbLatency = Math.round(latency[0] * 1e3 + latency[1] / 1e6);
  } catch (error) {
    logger.error("Database health check failed", { error: error.message });
  }

  res.status(dbStatus === "connected" ? 200 : 503).json({
    status: dbStatus,
    database: {
      type: "PostgreSQL",
      latency: `${dbLatency}ms`
    },
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
}));


app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    data: { message: "Clinic Management System API", version: "1.0.0", endpoints: "/api-docs" },
  });
});


// API routes
import authRoutes from "./routes/authRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";
import consultationRoutes from "./routes/consultationRoutes.js";
import medicineRoutes from "./routes/medicineRoutes.js";
import prescriptionRoutes from "./routes/prescriptionRoutes.js";
import conditionRoutes from "./routes/conditionRoutes.js";
import vitalRoutes from "./routes/vitalRoutes.js";
import symptomRoutes from "./routes/symptomRoutes.js";
import followupRoutes from "./routes/followupRoutes.js";
import testsRoutes from "./routes/testRoutes.js";
import examRoutes from "./routes/neuroExamRoutes.js";
import patientHistoryRoutes from "./routes/patientHistoryRoutes.js";
import neuroOptionsRoutes from "./routes/neuroOptionsRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import suggestionRoutes from "./routes/suggestionRoutes.js";
import chatbotRoutes from "./routes/chatbotRoutes.js";
import { followUpReminderHandler } from "./cron/followUpReminder.js";
import { requireAuth } from "./middleware/auth.js";

app.get("/ping", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.send("Pong at " + new Date().toISOString());
  } catch (error) {
    res.status(500).send("DB connection failed");
  }
});

// Cron endpoints protected by CRON_SECRET, not JWT
app.get("/api/cron/follow-up-reminders", followUpReminderHandler);
app.get("/api/cron/db-keepalive", async (req, res) => {
  const secret = req.headers["x-cron-secret"] || req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Cache-Control headers for static/semi-static list endpoints
// Browsers and CDNs cache for 5 min; serve stale for up to 10 min while revalidating
const cacheHeaders = (maxAge, swr = maxAge * 2) => (req, res, next) => {
  if (req.method === "GET") {
    res.set("Cache-Control", `public, max-age=${maxAge}, stale-while-revalidate=${swr}`);
  }
  next();
};

// ── Public routes (no auth required) ───────────────────────────────────────
app.use("/api/auth", authRoutes);

// ── Protect everything below this line ─────────────────────────────────────
app.use(requireAuth);

// ── Protected routes ────────────────────────────────────────────────────────
app.use("/api/patients", patientRoutes);
app.use("/api/consultations", consultationRoutes);
app.use("/api/medicines", cacheHeaders(300), medicineRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/conditions", conditionRoutes);
app.use("/api/vitals", vitalRoutes);
app.use("/api/followups", followupRoutes);
app.use("/api/symptoms", cacheHeaders(300), symptomRoutes);
app.use("/api/tests", cacheHeaders(300), testsRoutes);
app.use("/api/examination", examRoutes);
app.use("/api", patientHistoryRoutes);
app.use("/api/neuro-options", cacheHeaders(900), neuroOptionsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/suggest", suggestionRoutes);
app.use("/api/chatbot", chatbotRoutes);

// 404 Handler
app.use((req, res, next) => {
  next(new ApiError(404, `Endpoint not found: ${req.method} ${req.originalUrl}`));
});

// Global error handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isProduction = config.server.env === "production";

  // Handle PostgreSQL errors
  let message = err.message;
  if (err.code) {
    switch(err.code) {
      case '23505':
        message = "Duplicate entry detected";
        break;
      case '22P02':
        message = "Invalid data format";
        break;
      case '23503':
        message = "Related record not found";
        break;
    }
  }

  // Log error details
  logger.error(message, {
    statusCode,
    path: req.path,
    method: req.method,
    stack: isProduction ? undefined : err.stack,
    dbErrorCode: err.code
  });

  res.status(statusCode).json({
    success: false,
    message: isProduction && statusCode === 500
      ? "Internal server error"
      : message,
    ...(!isProduction && {
      errorCode: err.code,
      details: err.details
    })
  });
});

export default app;

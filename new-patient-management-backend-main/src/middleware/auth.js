// src/middleware/auth.js
// JWT authentication middleware.
// Usage: import { requireAuth, requireRole } from '../middleware/auth.js'
//        router.get('/protected', requireAuth, handler)
//        router.post('/admin-only', requireAuth, requireRole('admin'), handler)

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET environment variable is required in production");
}

/**
 * Verifies the Bearer token in Authorization header.
 * Attaches decoded payload to req.user on success.
 */
export const requireAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET || "dev-secret-change-in-production");
    next();
  } catch (err) {
    const message = err.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
    return res.status(401).json({ success: false, message });
  }
};

/**
 * Restricts access to users with a specific role.
 * Must be used after requireAuth.
 */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "Insufficient permissions" });
  }
  next();
};

/**
 * Signs a JWT token for a user.
 * @param {object} payload - { id, email, role }
 * @param {string} expiresIn - e.g. '24h', '7d'
 */
export const signToken = (payload, expiresIn = "24h") =>
  jwt.sign(payload, JWT_SECRET || "dev-secret-change-in-production", { expiresIn });

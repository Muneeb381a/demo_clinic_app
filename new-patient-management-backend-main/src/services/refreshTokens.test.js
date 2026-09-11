import { describe, it, expect } from "vitest";
import { refreshCookieOptions, REFRESH_COOKIE, REFRESH_TTL_DAYS } from "./refreshTokens.js";

describe("refreshCookieOptions", () => {
  it("is not Secure for a plain http request, regardless of NODE_ENV", () => {
    // Regression: this used to read process.env.NODE_ENV directly, so a
    // misconfigured NODE_ENV=production in local dev made the cookie Secure
    // over plain http — the browser silently drops it and every session dies
    // on the next reload/refresh.
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const opts = refreshCookieOptions({ secure: false, headers: {} });
      expect(opts.secure).toBe(false);
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  it("is Secure when Express reports the connection as secure", () => {
    const opts = refreshCookieOptions({ secure: true, headers: {} });
    expect(opts.secure).toBe(true);
  });

  it("is Secure behind a proxy that sets X-Forwarded-Proto: https", () => {
    const opts = refreshCookieOptions({ secure: false, headers: { "x-forwarded-proto": "https" } });
    expect(opts.secure).toBe(true);
  });

  it("tolerates a missing request object", () => {
    expect(() => refreshCookieOptions()).not.toThrow();
    expect(refreshCookieOptions().secure).toBe(false);
  });

  it("is httpOnly, SameSite=Lax, and scoped to /api/auth", () => {
    const opts = refreshCookieOptions({ secure: false, headers: {} });
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/api/auth");
    expect(opts.maxAge).toBe(REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  });
});

describe("REFRESH_COOKIE", () => {
  it("is the cookie name the frontend and controller agree on", () => {
    expect(REFRESH_COOKIE).toBe("rt");
  });
});

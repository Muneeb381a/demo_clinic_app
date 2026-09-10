import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory stand-in for the token the real axiosClient owns.
let token = null;
const post = vi.fn();

vi.mock("./axiosClient", () => ({
  default: { post: (...a) => post(...a) },
  _setAccessToken: (t) => { token = t; },
  _getAccessToken: () => token,
}));

const { login, logout, bootstrapSession, getAccessToken, getUser } = await import("./auth");

beforeEach(() => {
  token = null;
  post.mockReset();
});

describe("login", () => {
  it("stores the access token and user from the response", async () => {
    post.mockResolvedValueOnce({ data: { accessToken: "acc-1", user: { id: 7, name: "Doc" } } });

    const user = await login("doc@clinic.pk", "pw");

    expect(post).toHaveBeenCalledWith("/api/auth/login", { email: "doc@clinic.pk", password: "pw" });
    expect(getAccessToken()).toBe("acc-1");
    expect(getUser()).toEqual({ id: 7, name: "Doc" });
    expect(user).toEqual({ id: 7, name: "Doc" });
  });

  it("propagates a failed login and leaves no token", async () => {
    post.mockRejectedValueOnce(new Error("401"));
    await expect(login("x@y.z", "bad")).rejects.toThrow();
    expect(getAccessToken()).toBeNull();
  });
});

describe("bootstrapSession", () => {
  it("returns the user when the refresh cookie is valid", async () => {
    post.mockResolvedValueOnce({ data: { accessToken: "acc-2", user: { id: 3 } } });
    const user = await bootstrapSession();
    expect(post).toHaveBeenCalledWith("/api/auth/refresh");
    expect(user).toEqual({ id: 3 });
    expect(getAccessToken()).toBe("acc-2");
  });

  it("returns null and clears the session when refresh fails", async () => {
    token = "stale";
    post.mockRejectedValueOnce(new Error("401"));
    const user = await bootstrapSession();
    expect(user).toBeNull();
    expect(getAccessToken()).toBeNull();
  });
});

describe("logout", () => {
  it("clears the session even if the logout request throws", async () => {
    token = "acc-3";
    post.mockRejectedValueOnce(new Error("network"));
    await logout();
    expect(post).toHaveBeenCalledWith("/api/auth/logout");
    expect(getAccessToken()).toBeNull();
    expect(getUser()).toBeNull();
  });
});

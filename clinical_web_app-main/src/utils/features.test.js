import { describe, it, expect } from "vitest";
import { hasFeature } from "./features";

describe("hasFeature", () => {
  it("returns true when the clinic's features has that flag on", () => {
    const user = { clinic: { plan: "hospital", features: { chatbot: true } } };
    expect(hasFeature(user, "chatbot")).toBe(true);
  });

  it("returns false when the flag is explicitly off", () => {
    const user = { clinic: { plan: "clinic", features: { chatbot: false } } };
    expect(hasFeature(user, "chatbot")).toBe(false);
  });

  it("returns false when the flag is missing entirely", () => {
    const user = { clinic: { plan: "clinic", features: {} } };
    expect(hasFeature(user, "chatbot")).toBe(false);
  });

  it("returns false for a platform admin (clinic: null)", () => {
    const user = { role: "platform_admin", clinic: null };
    expect(hasFeature(user, "chatbot")).toBe(false);
  });

  it("returns false for undefined/null user without throwing", () => {
    expect(hasFeature(undefined, "chatbot")).toBe(false);
    expect(hasFeature(null, "chatbot")).toBe(false);
  });
});

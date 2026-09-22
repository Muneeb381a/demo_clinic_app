import { describe, it, expect } from "vitest";
import { hasFeature, isTrialExpired, trialDaysLeft } from "./features";

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

describe("isTrialExpired", () => {
  it("mirrors whatever the server already decided — display only, never computed here", () => {
    expect(isTrialExpired({ clinic: { trial_expired: true } })).toBe(true);
    expect(isTrialExpired({ clinic: { trial_expired: false } })).toBe(false);
    expect(isTrialExpired({ clinic: null })).toBe(false);
    expect(isTrialExpired(undefined)).toBe(false);
  });
});

describe("trialDaysLeft", () => {
  it("returns null for a non-trial clinic", () => {
    expect(trialDaysLeft({ clinic: { is_trial: false } })).toBeNull();
  });

  it("returns null once expired, even if trial_ends_at math would say otherwise", () => {
    const user = { clinic: { is_trial: true, trial_expired: true, trial_ends_at: new Date(Date.now() + 86400000).toISOString() } };
    expect(trialDaysLeft(user)).toBeNull();
  });

  it("returns null when the trial hasn't started (no trial_ends_at yet)", () => {
    expect(trialDaysLeft({ clinic: { is_trial: true, trial_expired: false, trial_ends_at: null } })).toBeNull();
  });

  it("rounds up to whole days remaining", () => {
    const user = { clinic: { is_trial: true, trial_expired: false, trial_ends_at: new Date(Date.now() + 2.1 * 86400000).toISOString() } };
    expect(trialDaysLeft(user)).toBe(3);
  });
});

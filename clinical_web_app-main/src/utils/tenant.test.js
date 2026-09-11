import { describe, it, expect } from "vitest";
import { getSubdomainSlug } from "./tenant";

describe("getSubdomainSlug", () => {
  it("extracts the clinic slug from a subdomain of the configured root domain", () => {
    expect(getSubdomainSlug("greenvalley.yourapp.com", "yourapp.com")).toBe("greenvalley");
  });

  it("returns null when no root domain is configured (feature inert by default)", () => {
    expect(getSubdomainSlug("greenvalley.yourapp.com", undefined)).toBeNull();
  });

  it("returns null for the apex domain itself", () => {
    expect(getSubdomainSlug("yourapp.com", "yourapp.com")).toBeNull();
  });

  it("returns null for www", () => {
    expect(getSubdomainSlug("www.yourapp.com", "yourapp.com")).toBeNull();
  });

  it("returns null for a *.vercel.app deployment URL (different root domain)", () => {
    expect(getSubdomainSlug("demo-clinic-app.vercel.app", "yourapp.com")).toBeNull();
  });

  it("returns null for localhost during dev", () => {
    expect(getSubdomainSlug("localhost", "yourapp.com")).toBeNull();
  });

  it("returns null for a nested subdomain rather than guessing", () => {
    expect(getSubdomainSlug("staging.greenvalley.yourapp.com", "yourapp.com")).toBeNull();
  });

  it("is case-sensitive to the hostname as given (browsers lower-case hostnames already)", () => {
    expect(getSubdomainSlug("greenvalley.yourapp.com", "yourapp.com")).toBe("greenvalley");
  });
});

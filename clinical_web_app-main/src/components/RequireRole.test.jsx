import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RequireRole, { isDoctor, isOwner } from "./RequireRole";

let mockUser = null;
vi.mock("../utils/auth", () => ({
  getUser: () => mockUser,
}));

const renderWith = (allow) =>
  render(
    <MemoryRouter>
      <RequireRole allow={allow}>
        <div>Protected content</div>
      </RequireRole>
    </MemoryRouter>
  );

describe("RequireRole", () => {
  it("renders children when allow() passes", () => {
    mockUser = { role: "doctor" };
    renderWith(isDoctor);
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("shows a permission-denied screen instead of children when allow() fails", () => {
    mockUser = { role: "receptionist" };
    renderWith(isDoctor);
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    expect(screen.getByText(/don't have access/i)).toBeInTheDocument();
  });

  it("isDoctor allows doctor and platform_admin, not receptionist", () => {
    expect(isDoctor({ role: "doctor" })).toBe(true);
    expect(isDoctor({ role: "platform_admin" })).toBe(true);
    expect(isDoctor({ role: "receptionist" })).toBe(false);
    expect(isDoctor(undefined)).toBe(false);
  });

  it("isOwner reflects is_owner regardless of role", () => {
    expect(isOwner({ role: "doctor", is_owner: true })).toBe(true);
    expect(isOwner({ role: "doctor", is_owner: false })).toBe(false);
    expect(isOwner(undefined)).toBe(false);
  });
});

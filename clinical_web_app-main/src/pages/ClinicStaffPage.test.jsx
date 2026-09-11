import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ClinicStaffPage from "./ClinicStaffPage";

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();

vi.mock("../utils/axiosClient", () => ({
  default: { get: (...a) => get(...a), post: (...a) => post(...a), delete: (...a) => del(...a) },
}));

vi.mock("../utils/auth", () => ({
  getUser: () => ({ id: 1, name: "Owner", role: "doctor", is_owner: true }),
}));

const staffResponse = {
  data: {
    staff: [
      { id: 1, name: "Owner", email: "owner@t.pk", role: "doctor", is_owner: true },
      { id: 2, name: "Front Desk", email: "fd@t.pk", role: "receptionist", is_owner: false },
    ],
    pendingInvites: [{ id: 9, email: "pending@t.pk", role: "doctor", expires_at: "2030-01-01" }],
  },
};

const renderPage = () => render(<MemoryRouter><ClinicStaffPage /></MemoryRouter>);

beforeEach(() => {
  get.mockReset().mockResolvedValue(staffResponse);
  post.mockReset();
  del.mockReset();
});

describe("ClinicStaffPage", () => {
  it("lists current staff and pending invites", async () => {
    renderPage();
    expect(await screen.findByText("Front Desk")).toBeInTheDocument();
    expect(screen.getByText(/pending@t\.pk/)).toBeInTheDocument();
  });

  it("creates an invite and shows the shareable link", async () => {
    post.mockResolvedValueOnce({ data: { invite: { token: "newtoken123", email: "x@t.pk", role: "receptionist" } } });
    renderPage();
    await screen.findByText("Front Desk");

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "x@t.pk" } });
    fireEvent.click(screen.getByRole("button", { name: /create invite/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/clinic/invites", { email: "x@t.pk", role: "receptionist" }));
    expect(await screen.findByText(/join\/newtoken123/)).toBeInTheDocument();
  });

  it("removes a non-owner staff member but not the owner themselves", async () => {
    del.mockResolvedValueOnce({ data: { success: true } });
    renderPage();
    await screen.findByText("Front Desk");

    // Only one Remove button — the owner row and the caller's own row don't get one.
    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    expect(removeButtons).toHaveLength(1);
    fireEvent.click(removeButtons[0]);

    await waitFor(() => expect(del).toHaveBeenCalledWith("/api/clinic/staff/2"));
  });
});

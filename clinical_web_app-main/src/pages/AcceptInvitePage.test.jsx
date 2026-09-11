import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AcceptInvitePage from "./AcceptInvitePage";

const get = vi.fn();
const post = vi.fn();
const setSession = vi.fn();

vi.mock("../utils/axiosClient", () => ({
  default: { get: (...a) => get(...a), post: (...a) => post(...a) },
}));

vi.mock("../utils/auth", () => ({
  setSession: (...a) => setSession(...a),
}));

const type = (el, value) => fireEvent.change(el, { target: { value } });

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  setSession.mockReset();
});

describe("AcceptInvitePage", () => {
  it("shows the clinic/role preview once the token resolves", async () => {
    get.mockResolvedValueOnce({ data: { invite: { email: "new@t.pk", role: "receptionist", clinicName: "Green Valley" } } });
    render(<AcceptInvitePage token="abc123" />);
    expect(await screen.findByText(/Join Green Valley/)).toBeInTheDocument();
    expect(screen.getByText(/invited as a receptionist/)).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/api/auth/invite/abc123");
  });

  it("shows an error for an invalid or expired token", async () => {
    get.mockRejectedValueOnce({ response: { data: { message: "This invite link is invalid or has expired" } } });
    render(<AcceptInvitePage token="dead" />);
    expect(await screen.findByText(/invalid or has expired/)).toBeInTheDocument();
  });

  it("submits name + password and starts the session on success", async () => {
    get.mockResolvedValueOnce({ data: { invite: { email: "new@t.pk", role: "doctor", clinicName: "Green Valley" } } });
    post.mockResolvedValueOnce({ data: { accessToken: "tok", user: { id: 1, role: "doctor" } } });
    const onAccepted = vi.fn();

    render(<AcceptInvitePage token="abc123" onAccepted={onAccepted} />);
    await screen.findByText(/Join Green Valley/);

    type(screen.getByLabelText("Your name"), "New Doctor");
    type(screen.getByLabelText("Choose a password"), "password1");
    fireEvent.click(screen.getByRole("button", { name: /join clinic/i }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/api/auth/accept-invite", { token: "abc123", name: "New Doctor", password: "password1" })
    );
    expect(setSession).toHaveBeenCalledWith({ accessToken: "tok", user: { id: 1, role: "doctor" } });
    expect(onAccepted).toHaveBeenCalled();
  });
});

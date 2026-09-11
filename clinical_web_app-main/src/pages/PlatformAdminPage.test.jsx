import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import PlatformAdminPage from "./PlatformAdminPage";

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();

vi.mock("../utils/axiosClient", () => ({
  default: { get: (...a) => get(...a), post: (...a) => post(...a), patch: (...a) => patch(...a) },
}));

vi.mock("../utils/auth", () => ({
  getUser: () => ({ name: "Platform Admin", email: "admin@t.pk", role: "platform_admin" }),
  logout: vi.fn(),
}));

const clinicsResponse = {
  data: {
    clinics: [
      { id: 1, name: "Green Valley", slug: "green-valley", doctor_count: 2, max_doctors: 3, receptionist_count: 1, max_receptionists: 2, status: "active" },
    ],
  },
};

const type = (el, value) => fireEvent.change(el, { target: { value } });

beforeEach(() => {
  get.mockReset().mockResolvedValue(clinicsResponse);
  post.mockReset();
  patch.mockReset();
});

describe("PlatformAdminPage", () => {
  it("loads and lists existing clinics", async () => {
    render(<PlatformAdminPage />);
    expect(await screen.findByText("Green Valley")).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("submits the create-clinic form with the owner payload", async () => {
    post.mockResolvedValueOnce({
      data: { clinic: { id: 2, name: "New Clinic", slug: "new-clinic" }, owner: { email: "owner@t.pk", role: "doctor", is_owner: true } },
    });
    render(<PlatformAdminPage />);
    await screen.findByText("Green Valley");

    type(screen.getByLabelText("Clinic name"), "New Clinic");
    type(screen.getByLabelText("Owner name"), "Dr Owner");
    type(screen.getByLabelText("Owner email"), "owner@t.pk");
    type(screen.getByLabelText("Owner password"), "password1");

    fireEvent.click(screen.getByRole("button", { name: /create clinic/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith(
      "/api/platform/clinics",
      expect.objectContaining({
        name: "New Clinic",
        slug: "new-clinic",
        owner: expect.objectContaining({ name: "Dr Owner", email: "owner@t.pk", password: "password1" }),
      })
    ));
    expect(await screen.findByText(/created\. share these credentials/i)).toBeInTheDocument();
  });

  it("toggles a clinic's status via PATCH", async () => {
    patch.mockResolvedValueOnce({ data: { clinic: { id: 1, status: "suspended" } } });
    render(<PlatformAdminPage />);
    const suspendBtn = await screen.findByRole("button", { name: /suspend/i });
    fireEvent.click(suspendBtn);
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/api/platform/clinics/1", { status: "suspended" }));
  });
});

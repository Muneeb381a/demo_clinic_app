import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import IpdPage from "./IpdPage";

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
vi.mock("../utils/axiosClient", () => ({ default: { get: (...a) => get(...a), post: (...a) => post(...a), put: (...a) => put(...a) } }));

const beds = [
  { id: 1, bed_no: "G-1", status: "occupied", ward_name: "General", daily_rate: "2000", patient_name: "Sara" },
  { id: 2, bed_no: "G-2", status: "available", ward_name: "General", daily_rate: "2000" },
  { id: 3, bed_no: "G-3", status: "cleaning", ward_name: "General", daily_rate: "2000" },
];

beforeEach(() => {
  get.mockReset(); post.mockReset(); put.mockReset();
  get.mockImplementation((url) => {
    if (url === "/api/ipd/beds") return Promise.resolve({ data: { beds, counts: { total: 3, available: 1, occupied: 1, cleaning: 1, maintenance: 0 } } });
    if (url.startsWith("/api/ipd/admissions")) return Promise.resolve({ data: { admissions: [{ id: 9, admission_no: "ADM-000001", patient_name: "Sara", ward_name: "General", bed_no: "G-1", admitted_at: new Date().toISOString() }] } });
    if (url === "/api/ipd/doctors") return Promise.resolve({ data: { doctors: [{ doctor_id: 4, name: "Ahmed" }] } });
    if (url.startsWith("/api/patients/search")) return Promise.resolve({ data: { exists: true, data: [{ id: 5, name: "Ali", mobile: "0300" }] } });
    return Promise.reject(new Error("unexpected " + url));
  });
});

describe("IpdPage", () => {
  it("shows bed counts, occupants and current admissions", async () => {
    render(<IpdPage />);
    expect(await screen.findByText("ADM-000001")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getAllByText("Sara").length).toBeGreaterThan(0);
  });

  it("marks a cleaning bed available via the status endpoint", async () => {
    put.mockResolvedValueOnce({ data: {} });
    render(<IpdPage />);
    fireEvent.click(await screen.findByText("Mark available"));
    await waitFor(() => expect(put).toHaveBeenCalledWith("/api/ipd/beds/3/status", { status: "available" }));
  });

  it("admits into a chosen free bed, sending ids only", async () => {
    post.mockResolvedValueOnce({ data: {} });
    render(<IpdPage />);
    await screen.findByText("ADM-000001");
    fireEvent.change(screen.getByLabelText("Search patient"), { target: { value: "Ali" } });
    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    fireEvent.click(await screen.findByText("Ali"));
    fireEvent.change(screen.getByLabelText("Bed"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Admit" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/ipd/admissions", { patient_id: 5, bed_id: 2, doctor_id: undefined, diagnosis: undefined }));
  });
});

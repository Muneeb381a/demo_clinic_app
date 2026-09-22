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
const admitted = [{ id: 9, admission_no: "ADM-000001", patient_name: "Sara", ward_name: "General", bed_no: "G-1", admitted_at: new Date().toISOString() }];
const discharged = [{ id: 10, admission_no: "ADM-000002", patient_name: "Bilal", discharged_at: new Date().toISOString() }];

beforeEach(() => {
  get.mockReset(); post.mockReset(); put.mockReset();
  get.mockImplementation((url) => {
    if (url === "/api/ipd/beds") return Promise.resolve({ data: { beds, counts: { total: 3, available: 1, occupied: 1, cleaning: 1, maintenance: 0 } } });
    if (url === "/api/ipd/admissions?status=admitted") return Promise.resolve({ data: { admissions: admitted } });
    if (url === "/api/ipd/admissions?status=discharged") return Promise.resolve({ data: { admissions: discharged } });
    if (url === "/api/ipd/doctors") return Promise.resolve({ data: { doctors: [{ doctor_id: 4, name: "Ahmed" }] } });
    if (url === "/api/billing/doctors") return Promise.resolve({ data: { doctors: [{ doctor_id: 4, name: "Ahmed", consultation_fee: "1000", configured: true }] } });
    if (url === "/api/billing/services") return Promise.resolve({ data: { services: [{ id: 1, name: "ECG", price: "600", active: true }] } });
    if (url.startsWith("/api/patients/search")) return Promise.resolve({ data: { exists: true, data: [{ id: 5, name: "Ali", mobile: "0300" }] } });
    if (url === "/api/ipd/admissions/9/running-bill") {
      return Promise.resolve({ data: { admission: { status: "admitted" }, items: [{ description: "Room rent — General / G-1 (2 days)", amount: "4000" }], subtotal: "4000", deposits: [], deposit_total: "0", balance_so_far: "4000", finalized_bill_id: null } });
    }
    if (url === "/api/ipd/admissions/10/running-bill") {
      return Promise.resolve({ data: { admission: { status: "discharged" }, items: [], subtotal: "2000", deposits: [], deposit_total: "0", balance_so_far: "2000", finalized_bill_id: null } });
    }
    return Promise.reject(new Error("unexpected " + url));
  });
});

describe("IpdPage", () => {
  it("shows bed counts, admitted patients, and the discharged-awaiting-bill list", async () => {
    render(<IpdPage />);
    expect(await screen.findByText("ADM-000001")).toBeInTheDocument();
    expect(screen.getByText("ADM-000002")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
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

  it("expands an admitted patient's billing panel and records a deposit", async () => {
    post.mockResolvedValueOnce({ data: { deposit: {} } });
    render(<IpdPage />);
    await screen.findByText("ADM-000001");
    fireEvent.click(screen.getAllByText("Billing")[0]);
    await screen.findByText(/Balance so far/);
    fireEvent.change(screen.getByLabelText("Deposit amount"), { target: { value: "2000" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/ipd/admissions/9/deposits", { amount: 2000, method: "cash" }));
  });

  it("finalizes the bill for a discharged patient and opens the receipt", async () => {
    post.mockResolvedValueOnce({ data: { bill: { id: 77 } } });
    render(<IpdPage />);
    await screen.findByText("ADM-000002");
    fireEvent.click(screen.getAllByText("Billing")[1]);
    await screen.findByText("Finalize bill");
    get.mockImplementation((url) => url === "/api/billing/bills/77"
      ? Promise.resolve({ data: { bill: { id: 77, bill_no: "IPD-000001", total: "2000", paid: "0", subtotal: "2000", discount: "0", status: "unpaid", created_at: new Date().toISOString(), clinic_name: "C", patient_name: "Bilal" }, items: [], payments: [] } })
      : Promise.resolve({ data: { beds: [], counts: {}, admissions: [], doctors: [], services: [] } }));
    fireEvent.click(screen.getByRole("button", { name: "Finalize bill" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/ipd/admissions/10/bill", { discount: 0, payment: undefined }));
    expect(await screen.findByText("IPD-000001")).toBeInTheDocument();
  });
});

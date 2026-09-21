import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import BillingPage from "./BillingPage";

const get = vi.fn();
const post = vi.fn();
vi.mock("../utils/axiosClient", () => ({ default: { get: (...a) => get(...a), post: (...a) => post(...a) } }));
vi.mock("../utils/auth", () => ({ getUser: () => ({ role: "receptionist", is_owner: false }) }));

const doctors = [
  { doctor_id: 7, name: "Ahmed", consultation_fee: "1000", followup_fee: "500", configured: true },
  { doctor_id: 8, name: "Nofee", consultation_fee: "0", followup_fee: "0", configured: false },
];

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  get.mockImplementation((url) => {
    if (url.startsWith("/api/billing/bills")) return Promise.resolve({ data: { bills: [] } });
    if (url === "/api/billing/doctors") return Promise.resolve({ data: { doctors } });
    if (url === "/api/billing/services") return Promise.resolve({ data: { services: [{ id: 1, name: "ECG", price: "600", active: true }] } });
    if (url === "/api/billing/summary/today") return Promise.resolve({ data: { collected: "2500", bills: 3 } });
    if (url.startsWith("/api/patients/search")) return Promise.resolve({ data: { exists: true, data: [{ id: 5, name: "Sara", mobile: "03001234567" }] } });
    return Promise.reject(new Error("unexpected " + url));
  });
});

describe("BillingPage", () => {
  it("shows today's collection and only doctors that have a fee", async () => {
    render(<BillingPage />);
    expect(await screen.findByText(/Rs 2,500/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search patient"), { target: { value: "Sara" } });
    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    fireEvent.click(await screen.findByText("Sara"));
    expect(await screen.findByText("Dr. Ahmed")).toBeInTheDocument();
    expect(screen.queryByText("Dr. Nofee")).not.toBeInTheDocument();
  });

  it("previews the total and sends ids (never prices) to the server", async () => {
    post.mockResolvedValueOnce({ data: { bill: { id: 99 } } });
    render(<BillingPage />);
    await screen.findByText(/Rs 2,500/);
    fireEvent.change(screen.getByLabelText("Search patient"), { target: { value: "Sara" } });
    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    fireEvent.click(await screen.findByText("Sara"));
    fireEvent.click(await screen.findByLabelText(/Consultation/));
    fireEvent.change(screen.getByLabelText("Quantity of ECG"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(/Discount/), { target: { value: "200" } });
    expect(screen.getByTestId("bill-total")).toHaveTextContent("2,000"); // 1000 + 2*600 - 200

    get.mockImplementation((url) => url === "/api/billing/bills/99"
      ? Promise.resolve({ data: { bill: { id: 99, bill_no: "OPD-000001", total: "2000", paid: "0", subtotal: "2200", discount: "200", status: "unpaid", created_at: new Date().toISOString(), clinic_name: "C", patient_name: "Sara" }, items: [], payments: [] } })
      : Promise.resolve({ data: { bills: [], doctors, services: [], collected: "0" } }));
    fireEvent.click(screen.getByRole("button", { name: /create bill/i }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    const [url, body] = post.mock.calls[0];
    expect(url).toBe("/api/billing/bills");
    expect(body.items).toEqual([{ type: "consultation", doctor_id: 7 }, { type: "service", service_id: 1, qty: 2 }]);
    expect(body.discount).toBe(200);
    expect(JSON.stringify(body)).not.toMatch(/price|unit|amount/);
    expect(await screen.findByText("OPD-000001")).toBeInTheDocument();
  });
});

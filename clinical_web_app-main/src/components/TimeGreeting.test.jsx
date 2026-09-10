import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import TimeGreeting from "./TimeGreeting";

// TimeGreeting derives its label from the local hour. Pin the clock so the
// assertion is deterministic regardless of when/where the suite runs.
const renderAtHour = (hour) => {
  vi.setSystemTime(new Date(2026, 0, 15, hour, 0, 0));
  render(<TimeGreeting locale="en-PK" timeZone="Asia/Karachi" />);
};

describe("TimeGreeting", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] }));
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows 'Morning' before noon", () => {
    renderAtHour(9);
    expect(screen.getByText("Morning")).toBeInTheDocument();
  });

  it("shows 'Afternoon' between noon and 18:00", () => {
    renderAtHour(14);
    expect(screen.getByText("Afternoon")).toBeInTheDocument();
  });

  it("shows 'Evening' from 18:00 onward", () => {
    renderAtHour(20);
    expect(screen.getByText("Evening")).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { AssessmentApp } from "@/components/assessment/assessment-app";
import { DEVICE_LOCK_KEY } from "@/lib/assessment/device-lock";

// Rule: one attempt per device — once the lock exists in localStorage, the
// registration form must be replaced by the blocked screen.
describe("Device lock", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the registration form when no lock exists", async () => {
    render(<AssessmentApp />);
    await waitFor(() => expect(screen.getByText("Candidate registration")).toBeTruthy());
    expect(screen.queryByText("Device already used")).toBeNull();
  });

  it("blocks registration when the device was already used", async () => {
    localStorage.setItem(
      DEVICE_LOCK_KEY,
      JSON.stringify({ attemptId: "12345678-abcd", name: "Prior User", email: "p@x.com", at: new Date().toISOString() }),
    );
    render(<AssessmentApp />);
    await waitFor(() => expect(screen.getByText("Device already used")).toBeTruthy());
    expect(screen.getByText(/Prior User/)).toBeTruthy();
    expect(screen.queryByText("Candidate registration")).toBeNull();
  });
});

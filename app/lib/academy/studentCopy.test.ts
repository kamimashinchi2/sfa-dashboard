import { describe, expect, it } from "vitest";
import { missionHref, nextStep, statusLabel } from "./studentCopy";

describe("student next step", () => {
  it("tells a signed-out student to log in and use chat, not email", () => {
    const step = nextStep({ signedIn: false, status: null, stage: 1, locale: "en" });
    expect(step.href).toBe("/login");
    expect(step.body).toMatch(/Ask your mentor for a reset link/);
  });

  it("points an open lesson at the current mission and refuses a skip", () => {
    const step = nextStep({ signedIn: true, status: "LESSON_OPEN", stage: 5, locale: "en" });
    expect(step.href).toBe("/academy/missions/M5");
    expect(step.body).toMatch(/does not open the next lesson/i);
    expect(missionHref(8)).toBe("/academy/advanced/A8");
  });

  it("says a submitted practical is waiting, and stage 8 is the senior mentor", () => {
    expect(nextStep({ signedIn: true, status: "PRACTICAL_SUBMITTED", stage: 3, locale: "fa" }).body).toMatch(/نتیجه/);
    const done = nextStep({ signedIn: true, status: "AWAITING_SENIOR_MENTOR", stage: 8, locale: "en" });
    expect(done.body).toMatch(/no stage 9/i);
    expect(done.href).toBeNull();
  });

  it("uses plain status words", () => {
    expect(statusLabel("ASSIGNMENT_ISSUED", "en")).toMatch(/assignment/i);
    expect(statusLabel("NOPE", "fa")).toMatch(/نامشخص/);
  });
});

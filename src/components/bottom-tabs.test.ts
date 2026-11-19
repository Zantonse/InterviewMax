import { describe, expect, it } from "vitest";
import { INTERVIEW_TABS, PROMOTION_TABS, isTabActive } from "./bottom-tabs";

describe("bottom tabs", () => {
  it("has four places per mode, so Build sits in the middle", () => {
    expect(INTERVIEW_TABS).toHaveLength(4);
    expect(PROMOTION_TABS).toHaveLength(4);
  });
  it("lights Prep only on the home page", () => {
    const prep = INTERVIEW_TABS[0];
    expect(isTabActive(prep, "/")).toBe(true);
    expect(isTabActive(prep, "/jobs")).toBe(false);
  });
  it("lights Jobs on a job's own pages", () => {
    const jobs = INTERVIEW_TABS[1];
    expect(isTabActive(jobs, "/jobs/abc/warm-up")).toBe(true);
    expect(isTabActive(jobs, "/jobsx")).toBe(false);
  });
});

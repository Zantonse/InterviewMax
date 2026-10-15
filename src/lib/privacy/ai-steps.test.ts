import { describe, expect, it } from "vitest";
import { STEP_MODELS } from "@/lib/ai/config";
import { aiStepRows, aiVendors, stepVendor } from "./ai-steps";

describe("AI usage policy steps", () => {
  it("lists every model step the app runs", () => {
    expect(aiStepRows().map((r) => r.step)).toEqual(Object.keys(STEP_MODELS));
    for (const row of aiStepRows()) {
      expect(row.feature.length).toBeGreaterThan(0);
      expect(row.sends.length).toBeGreaterThan(0);
    }
  });

  it("names the company behind each model", () => {
    expect(stepVendor("storyWrite")).toBe("Anthropic");
    expect(stepVendor("storyGrade")).toBe("OpenAI");
    expect(aiVendors()).toEqual(["Anthropic", "OpenAI"]);
  });
});

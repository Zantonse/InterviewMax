import { describe, expect, it } from "vitest";
import { fillerSpans } from "./delivery";

describe("fillerSpans", () => {
  it("marks the filler words and keeps every character", () => {
    const text = "So, um, it was, like, huge, you know.";
    const spans = fillerSpans(text);
    expect(spans.map((s) => s.text).join("")).toBe(text);
    expect(spans.filter((s) => s.filler).map((s) => s.text)).toEqual(["um", "like", "you know"]);
  });

  it("leaves ordinary uses alone", () => {
    const spans = fillerSpans("I'd like the kind of check that runs overnight.");
    expect(spans.some((s) => s.filler)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { isSendKey } from "./keys";

describe("isSendKey", () => {
  it("is Ctrl or ⌘ with Enter", () => {
    expect(isSendKey({ key: "Enter", metaKey: true, ctrlKey: false })).toBe(true);
    expect(isSendKey({ key: "Enter", metaKey: false, ctrlKey: true })).toBe(true);
  });
  it("leaves plain Enter for a new line", () => {
    expect(isSendKey({ key: "Enter", metaKey: false, ctrlKey: false })).toBe(false);
    expect(isSendKey({ key: "a", metaKey: true, ctrlKey: false })).toBe(false);
  });
});

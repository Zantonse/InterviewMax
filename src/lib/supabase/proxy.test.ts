import { describe, expect, it } from "vitest";
import { isPublicPath } from "./proxy";

describe("isPublicPath", () => {
  it("lets signed-out visitors reach sign-in and the email link", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
  });

  it("protects everything else", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/stories")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
    expect(isPublicPath("/authorize")).toBe(false);
  });
});

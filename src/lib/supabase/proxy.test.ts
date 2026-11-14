import { describe, expect, it } from "vitest";
import { isPublicPath } from "./proxy";

describe("isPublicPath", () => {
  it("lets signed-out visitors reach sign-in and the email link", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
  });

  it("lets anyone read the public homepage", () => {
    expect(isPublicPath("/welcome")).toBe(true);
  });

  it("lets anyone read the policies and the account-deleted page", () => {
    expect(isPublicPath("/privacy")).toBe(true);
    expect(isPublicPath("/ai-usage")).toBe(true);
    expect(isPublicPath("/account-deleted")).toBe(true);
    expect(isPublicPath("/api/sims/session")).toBe(true);
    expect(isPublicPath("/api/simsx")).toBe(false);
    expect(isPublicPath("/settings")).toBe(false);
  });

  it("takes signal beacons from signed-out pages instead of redirecting their POST to /login", () => {
    expect(isPublicPath("/api/signals")).toBe(true);
  });

  it("protects everything else", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/stories")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
    expect(isPublicPath("/authorize")).toBe(false);
  });
});

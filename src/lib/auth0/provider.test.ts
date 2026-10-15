import { afterEach, describe, expect, it, vi } from "vitest";
import { authProvider } from "./provider";

describe("authProvider", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to Supabase", () => {
    vi.stubEnv("AUTH_PROVIDER", "");
    expect(authProvider()).toBe("supabase");
  });

  it("reads auth0 however it was typed", () => {
    for (const v of ["auth0", "Auth0", " auth0 ", '"auth0"']) {
      vi.stubEnv("AUTH_PROVIDER", v);
      expect(authProvider()).toBe("auth0");
    }
  });
});

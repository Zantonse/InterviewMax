import { describe, expect, it } from "vitest";
import { adminEmails, isAdminEmail } from "./access";

describe("adminEmails", () => {
  it("reads a comma-separated list, trimmed and lowercased", () => {
    expect(adminEmails(" Craig@Example.com, other@example.com ,")).toEqual([
      "craig@example.com",
      "other@example.com",
    ]);
  });

  it("is empty when unset or holding no emails", () => {
    expect(adminEmails(undefined)).toEqual([]);
    expect(adminEmails("")).toEqual([]);
    expect(adminEmails(" , nonsense ")).toEqual([]);
  });
});

describe("isAdminEmail", () => {
  const allowlist = ["craig@example.com"];

  it("matches regardless of case and spaces", () => {
    expect(isAdminEmail("Craig@Example.com ", allowlist)).toBe(true);
  });

  it("refuses everyone else", () => {
    expect(isAdminEmail("someone@example.com", allowlist)).toBe(false);
    expect(isAdminEmail("craig@example.com.evil.test", allowlist)).toBe(false);
  });

  it("refuses a missing email even with an empty allowlist entry", () => {
    expect(isAdminEmail("", allowlist)).toBe(false);
    expect(isAdminEmail(undefined, allowlist)).toBe(false);
    expect(isAdminEmail("", [])).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { jwtExpiresAt, needsRefresh, safeReturnTo } from "./tokens";

function jwt(payload: object) {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${part({ alg: "RS256" })}.${part(payload)}.sig`;
}

describe("jwtExpiresAt", () => {
  it("reads exp from the payload", () => {
    expect(jwtExpiresAt(jwt({ exp: 1700000000 }))).toBe(1700000000);
  });

  it("gives up quietly on anything else", () => {
    expect(jwtExpiresAt(undefined)).toBeUndefined();
    expect(jwtExpiresAt("not-a-jwt")).toBeUndefined();
    expect(jwtExpiresAt("a.%%%.c")).toBeUndefined();
    expect(jwtExpiresAt(jwt({ sub: "x" }))).toBeUndefined();
  });
});

describe("needsRefresh", () => {
  const now = 1_000_000;

  it("refreshes when the ID token runs out before the access token", () => {
    expect(needsRefresh({ idToken: jwt({ exp: now + 60 }), expiresAt: now + 86_400 }, now)).toBe(true);
  });

  it("refreshes when the access token is about to run out", () => {
    expect(needsRefresh({ idToken: jwt({ exp: now + 36_000 }), expiresAt: now + 30 }, now)).toBe(true);
  });

  it("leaves fresh tokens alone", () => {
    expect(needsRefresh({ idToken: jwt({ exp: now + 36_000 }), expiresAt: now + 86_400 }, now)).toBe(false);
    expect(needsRefresh({}, now)).toBe(false);
  });
});

describe("safeReturnTo", () => {
  const base = "https://interviewmax.example";

  it("keeps paths on this site", () => {
    expect(safeReturnTo("/stories/1?tab=2", base).href).toBe(`${base}/stories/1?tab=2`);
    expect(safeReturnTo(undefined, base).href).toBe(`${base}/`);
  });

  it("never sends people to another site", () => {
    expect(safeReturnTo("https://evil.example/x", base).href).toBe(`${base}/`);
    expect(safeReturnTo("//evil.example/x", base).href).toBe(`${base}/`);
  });
});

import { describe, expect, it } from "vitest";
import { isPersonaId, isSimEmail, secretMatches, simEmail, simsEnabled } from "./access";

const SECRET = "a".repeat(64);

describe("simsEnabled", () => {
  it("is off in production even with a secret", () => {
    expect(simsEnabled({ VERCEL_ENV: "production", SIM_USERS_SECRET: SECRET })).toBe(false);
  });

  it("needs a long secret", () => {
    expect(simsEnabled({ VERCEL_ENV: "preview" })).toBe(false);
    expect(simsEnabled({ VERCEL_ENV: "preview", SIM_USERS_SECRET: "short" })).toBe(false);
    expect(simsEnabled({ VERCEL_ENV: "preview", SIM_USERS_SECRET: SECRET })).toBe(true);
  });
});

describe("secretMatches", () => {
  it("accepts only the exact secret", () => {
    const env = { SIM_USERS_SECRET: SECRET };
    expect(secretMatches(SECRET, env)).toBe(true);
    expect(secretMatches(`${SECRET}x`, env)).toBe(false);
    expect(secretMatches("", env)).toBe(false);
    expect(secretMatches(null, env)).toBe(false);
  });

  it("refuses everything when no secret is set", () => {
    expect(secretMatches("", {})).toBe(false);
    expect(secretMatches("anything", { SIM_USERS_SECRET: "" })).toBe(false);
  });
});

describe("persona emails", () => {
  it("builds and recognises sim emails", () => {
    expect(simEmail("sales-engineer", {})).toBe("sim-sales-engineer@sims.interviewmax.test");
    expect(isSimEmail("sim-sales-engineer@sims.interviewmax.test", {})).toBe(true);
    expect(isSimEmail("SIM-designer@Sims.InterviewMax.test", {})).toBe(true);
  });

  it("rejects real addresses", () => {
    expect(isSimEmail("craig@gmail.com", {})).toBe(false);
    expect(isSimEmail("sim-x@gmail.com", {})).toBe(false);
    expect(isSimEmail("someone@sims.interviewmax.test", {})).toBe(false);
    expect(isSimEmail(null, {})).toBe(false);
  });

  it("follows SIM_EMAIL_DOMAIN", () => {
    const env = { SIM_EMAIL_DOMAIN: "example.org" };
    expect(simEmail("designer", env)).toBe("sim-designer@example.org");
    expect(isSimEmail("sim-designer@sims.interviewmax.test", env)).toBe(false);
  });

  it("checks persona ids", () => {
    expect(isPersonaId("data-governance")).toBe(true);
    expect(isPersonaId("Data")).toBe(false);
    expect(isPersonaId("a")).toBe(false);
    expect(isPersonaId("x".repeat(31))).toBe(false);
    expect(isPersonaId(3)).toBe(false);
  });
});

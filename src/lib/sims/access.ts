import { createHash, timingSafeEqual } from "node:crypto";

// Simulated users (persona runs, see scripts/sims/README.md): AI personas that sign in to a Vercel
// preview and build a story end to end. These checks decide whether the preview-only sign-in and
// result routes exist at all. They never exist in production, and only answer a caller holding
// SIM_USERS_SECRET.

type Env = Record<string, string | undefined>;

// Long enough that guessing it isn't a worry; `openssl rand -hex 32` gives 64 characters.
export const MIN_SECRET_LENGTH = 32;

export const DEFAULT_SIM_EMAIL_DOMAIN = "sims.interviewmax.test";

// Persona ids as the runner sends them (src/lib/sims/personas.ts): short, lower-case, dashes.
const PERSONA_ID_RE = /^[a-z][a-z0-9-]{1,29}$/;

export function simsEnabled(env: Env = process.env): boolean {
  if (env.VERCEL_ENV === "production") return false;
  return (env.SIM_USERS_SECRET ?? "").length >= MIN_SECRET_LENGTH;
}

// Compares hashes so the time taken says nothing about how much of the secret matched.
export function secretMatches(given: string | null | undefined, env: Env = process.env): boolean {
  const expected = env.SIM_USERS_SECRET ?? "";
  if (!given || expected.length < MIN_SECRET_LENGTH) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function isPersonaId(value: unknown): value is string {
  return typeof value === "string" && PERSONA_ID_RE.test(value);
}

export function simEmailDomain(env: Env = process.env): string {
  return (env.SIM_EMAIL_DOMAIN ?? "").trim().toLowerCase() || DEFAULT_SIM_EMAIL_DOMAIN;
}

// The persona's sign-in email: the Auth0 user Craig made for it has this address.
export function simEmail(persona: string, env: Env = process.env): string {
  return `sim-${persona}@${simEmailDomain(env)}`;
}

export function isSimEmail(email: string | null | undefined, env: Env = process.env): boolean {
  if (!email) return false;
  const [local, domain] = email.trim().toLowerCase().split("@");
  return domain === simEmailDomain(env) && /^sim-[a-z][a-z0-9-]{1,29}$/.test(local ?? "");
}

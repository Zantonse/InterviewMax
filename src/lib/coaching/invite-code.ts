// 1:1 coaching invite links (Craig, 2026-11-19). The link is /coach/<code>: a random code made
// once for one person, good for 14 days and for one use. Only a hash of the code is stored
// (supabase/migrations/20261119000000_coaching_clients.sql). Plain functions, safe in the proxy.

export const INVITE_PATH = "/coach";
export const INVITE_DAYS = 14;
// Signed out, the invite's code waits in this cookie through sign-in, then the proxy sends the
// person back to the consent screen.
export const INVITE_COOKIE = "imax_coach_invite";
export const MAX_LABEL_LENGTH = 80;

// The same shape accept_coach_invite() checks.
const CODE_RE = /^[A-Za-z0-9_-]{20,64}$/;

export function isInviteCode(value: unknown): value is string {
  return typeof value === "string" && CODE_RE.test(value);
}

// A new code: 24 random bytes as base64url (32 characters).
export function newInviteCode(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function invitePath(code: string): string {
  return `${INVITE_PATH}/${code}`;
}

// The code in /coach/<code>, or null for any other path.
export function inviteCodeFromPath(pathname: string): string | null {
  const prefix = `${INVITE_PATH}/`;
  if (!pathname.startsWith(prefix)) return null;
  const code = pathname.slice(prefix.length).replace(/\/$/, "");
  return isInviteCode(code) ? code : null;
}

export function cleanLabel(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_LABEL_LENGTH);
}

export type InviteStatus = "ok" | "invalid" | "used" | "expired" | "revoked";

export function parseInviteStatus(value: unknown): InviteStatus {
  return value === "ok" || value === "used" || value === "expired" || value === "revoked"
    ? value
    : "invalid";
}

// What the consent screen says when a link can't be used.
export const INVITE_PROBLEMS: Record<Exclude<InviteStatus, "ok">, string> = {
  invalid: "This invite link doesn't work. Check you copied all of it, or ask your coach for a new one.",
  used: "This invite link has already been used. Ask your coach for a new one.",
  expired: `Invite links last ${INVITE_DAYS} days, and this one has run out. Ask your coach for a new one.`,
  revoked: "Your coach cancelled this invite link. Ask them for a new one.",
};

// What the coach sees and doesn't, said the same way on the consent screen, in Settings and in the
// privacy policy.
export const COACH_SEES = [
  "Your target jobs and interview dates",
  "Your stories, their levels and grades",
  "Your practice rounds: the questions and how confident you felt",
  "Your interview profile: the strengths and weak spots from your past interviews",
] as const;

export const COACH_NEVER_SEES = [
  "Your uploads: resume, LinkedIn PDF and interview transcripts",
  "PromotionMax stories, unless you share one from its page",
] as const;

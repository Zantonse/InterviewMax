// Where the privacy pages tell people to write. Set PRIVACY_CONTACT_EMAIL in Vercel; until then
// the pages point testers at the person who invited them.
export function privacyContactEmail(env: Record<string, string | undefined> = process.env) {
  const email = (env.PRIVACY_CONTACT_EMAIL ?? "").trim();
  return email.includes("@") ? email : null;
}

export const POLICY_UPDATED = "October 17, 2026";

// What someone types to confirm deleting their account.
export const DELETE_CONFIRM_WORD = "delete";

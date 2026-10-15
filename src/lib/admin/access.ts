// Who may open the admin panel. For now an allowlist of emails in the ADMIN_EMAILS environment
// variable (comma-separated), read on the server only. When sign-in moves to Auth0 this is the one
// function to switch to an Auth0 role check.

export function adminEmails(raw: string | undefined = process.env.ADMIN_EMAILS): string[] {
  return (raw ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.includes("@"));
}

export function isAdminEmail(
  email: string | null | undefined,
  allowlist: string[] = adminEmails(),
): boolean {
  const normalized = (email ?? "").trim().toLowerCase();
  return normalized.length > 0 && allowlist.includes(normalized);
}

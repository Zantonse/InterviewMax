// Sign-in choices when Auth0 signs people in. Each goes straight to that provider through
// Auth0's /auth/login route (a plain link, so it is never prefetched). The connection names are
// Auth0's defaults; "email" is Auth0's passwordless email connection, set to send a code.
const CHOICES = [
  { connection: "google-oauth2", label: "Continue with Google" },
  { connection: "windowslive", label: "Continue with Microsoft" },
  { connection: "linkedin", label: "Continue with LinkedIn" },
] as const;

function loginHref(connection: string) {
  const params = new URLSearchParams({ connection, returnTo: "/" });
  return `/auth/login?${params}`;
}

export function Auth0Buttons() {
  return (
    <div className="flex flex-col gap-3">
      {CHOICES.map(({ connection, label }) => (
        <a
          key={connection}
          href={loginHref(connection)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center font-semibold text-slate-900 transition hover:border-navy-600 hover:bg-navy-50"
        >
          {label}
        </a>
      ))}
      <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-wide text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <a
        href={loginHref("email")}
        className="rounded-xl bg-navy-800 px-4 py-3 text-center font-semibold text-white transition hover:bg-navy-900"
      >
        Email me a sign-in code
      </a>
    </div>
  );
}

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// Sign-in choices when Auth0 signs people in. Each goes straight to that provider through
// Auth0's /auth/login route, which forwards every other query parameter to Auth0 (so the email
// form's login_hint pre-fills the address on Auth0's code page). The connection names are
// Auth0's defaults; "Username-Password-Authentication" is Auth0's email-and-password database
// (Auth0's own page handles the password, sign-up and resets); "email" is Auth0's passwordless
// email connection, set to send a code.
type Connection = "google-oauth2" | "linkedin" | typeof PASSWORD | "email";

const PASSWORD = "Username-Password-Authentication";

const LAST_USED_KEY = "interviewmax:last-sign-in";

const SOCIAL: { connection: Connection; label: string; Logo: () => React.ReactElement }[] = [
  { connection: "google-oauth2", label: "Google", Logo: GoogleLogo },
  { connection: "linkedin", label: "LinkedIn", Logo: LinkedInLogo },
];

function loginHref(connection: Connection, signUp = false) {
  const params = new URLSearchParams({ connection, returnTo: "/" });
  // Opens Auth0's page on its sign-up tab instead of sign-in.
  if (signUp) params.set("screen_hint", "signup");
  return `/auth/login?${params}`;
}

export function Auth0Buttons() {
  // Which choice is on its way to Auth0, so a slow redirect doesn't look like a dead click.
  const [opening, setOpening] = useState<Connection | null>(null);
  const lastUsed = useSyncExternalStore(noSubscribe, readLastUsed, () => null);

  useEffect(() => {
    // Coming back with the browser's back button restores this page from cache mid-redirect.
    const reset = (event: PageTransitionEvent) => event.persisted && setOpening(null);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  function start(connection: Connection) {
    setOpening(connection);
    try {
      localStorage.setItem(LAST_USED_KEY, connection);
    } catch {}
  }

  const busy = opening !== null;

  return (
    <div className="flex flex-col gap-3">
      {/* Email first: Continue goes to Auth0's password page with the address filled in (Auth0 takes
          the password, sign-up and resets); the second button sends a one-time code instead. A
          plain GET form to /auth/login, so it works before the page's JavaScript loads. The buttons
          are never `disabled`: a disabled submitter drops its connection from the request. */}
      <form
        action="/auth/login"
        method="get"
        onSubmit={(event) => {
          const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          start(submitter?.value === "email" ? "email" : PASSWORD);
        }}
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="returnTo" value="/" />
        <label
          htmlFor="login_hint"
          className="flex items-center justify-between text-sm font-medium text-slate-700"
        >
          Email
          {(lastUsed === PASSWORD || lastUsed === "email") && !busy && <LastUsed />}
        </label>
        <input
          id="login_hint"
          name="login_hint"
          type="email"
          required
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-ink-600 focus:ring-2 focus:ring-ink-600/20"
        />
        <button
          type="submit"
          name="connection"
          value={PASSWORD}
          aria-disabled={busy}
          className={`rounded-xl bg-accent-400 px-4 py-3 font-semibold text-ink-950 transition hover:bg-accent-300 ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          {opening === PASSWORD ? "One moment…" : "Continue with password"}
        </button>
        <button
          type="submit"
          name="connection"
          value="email"
          aria-disabled={busy}
          className={`text-sm font-medium text-ink-700 hover:underline ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          {opening === "email" ? "Sending your code…" : "No password? Email me a one-time code"}
        </button>
      </form>

      <div className="flex items-center gap-3 py-1 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or continue with
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {SOCIAL.map(({ connection, label, Logo }) => (
          <a
            key={connection}
            href={loginHref(connection)}
            onClick={() => start(connection)}
            aria-disabled={busy}
            aria-label={`Continue with ${label}`}
            className={`relative flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-semibold text-slate-900 transition hover:border-ink-400 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
              busy && opening !== connection ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <Logo />
            {opening === connection ? "Opening…" : label}
            {lastUsed === connection && !busy && <LastUsedDot />}
          </a>
        ))}
      </div>

      <p className="mt-4 border-t border-slate-100 pt-5 text-center text-sm text-slate-600">
        New to InterviewMax?{" "}
        <a
          href={loginHref(PASSWORD, true)}
          onClick={() => start(PASSWORD)}
          className="font-semibold text-ink-800 hover:underline"
        >
          Create an account
        </a>
      </p>
    </div>
  );
}

function noSubscribe() {
  return () => {};
}

function readLastUsed(): Connection | null {
  try {
    const saved = localStorage.getItem(LAST_USED_KEY);
    return saved === "google-oauth2" || saved === "linkedin" || saved === PASSWORD || saved === "email"
      ? saved
      : null;
  } catch {
    // Storage blocked (private window): just don't show the hint.
    return null;
  }
}

// The social buttons are too narrow for the label, so they get a dot with the words for screen readers.
function LastUsedDot() {
  return (
    <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-accent-500" title="Last used">
      <span className="sr-only">Last used</span>
    </span>
  );
}

function LastUsed() {
  return (
    <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[11px] font-semibold text-accent-900">
      Last used
    </span>
  );
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5 shrink-0">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function LinkedInLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
      <rect width="24" height="24" rx="4" fill="#0A66C2" />
      <path
        fill="#fff"
        d="M7.1 9.5h2.6V18H7.1V9.5zm1.3-4.2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM11.4 9.5h2.5v1.2h.04c.35-.66 1.2-1.36 2.47-1.36 2.64 0 3.13 1.74 3.13 4V18h-2.6v-4.1c0-.98-.02-2.24-1.36-2.24-1.37 0-1.58 1.07-1.58 2.17V18h-2.6V9.5z"
      />
    </svg>
  );
}

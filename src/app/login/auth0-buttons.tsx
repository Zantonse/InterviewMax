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
      {SOCIAL.map(({ connection, label, Logo }) => (
        <a
          key={connection}
          href={loginHref(connection)}
          onClick={() => start(connection)}
          aria-disabled={busy}
          className={`relative flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-900 transition hover:border-ink-400 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
            busy && opening !== connection ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <Logo />
          {opening === connection ? `Opening ${label}…` : `Continue with ${label}`}
          {lastUsed === connection && !busy && <LastUsed />}
        </a>
      ))}

      <a
        href={loginHref(PASSWORD)}
        onClick={() => start(PASSWORD)}
        aria-disabled={busy}
        className={`relative flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-900 transition hover:border-ink-400 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
          busy && opening !== PASSWORD ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <KeyIcon />
        {opening === PASSWORD ? "One moment…" : "Sign in with email and password"}
        {lastUsed === PASSWORD && !busy && <LastUsed />}
      </a>

      <details className="group" open={lastUsed === "email" || undefined}>
        <summary className="cursor-pointer list-none text-center text-sm font-medium text-ink-700 hover:underline [&::-webkit-details-marker]:hidden">
          No password? Email me a one-time code instead
        </summary>
        {/* A plain GET form to /auth/login, so it works before the page's JavaScript loads. */}
        <form
          action="/auth/login"
          method="get"
          onSubmit={() => start("email")}
          className="mt-3 flex flex-col gap-3"
        >
          <input type="hidden" name="connection" value="email" />
          <input type="hidden" name="returnTo" value="/" />
          <label htmlFor="login_hint" className="text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="login_hint"
            name="login_hint"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-ink-600 focus:ring-2 focus:ring-ink-600/20"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-900 transition hover:border-ink-400 hover:bg-ink-50 disabled:opacity-60"
          >
            {opening === "email" ? "One moment…" : "Email me a code"}
          </button>
        </form>
      </details>

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

function LastUsed() {
  return (
    <span className="absolute right-3 rounded-full bg-accent-100 px-2 py-0.5 text-[11px] font-semibold text-accent-900">
      Last used
    </span>
  );
}

function KeyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <circle cx="8" cy="15" r="4" />
      <path d="M10.85 12.15 19 4M18 5l2 2M15 8l2 2" />
    </svg>
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

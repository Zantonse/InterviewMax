import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PolicyLinks } from "@/components/policy-links";
import { Wordmark } from "@/components/wordmark";
import { auth0 as auth0Client } from "@/lib/auth0/client";
import { authProvider } from "@/lib/auth0/provider";
import { Auth0Buttons } from "./auth0-buttons";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · InterviewMax" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  const auth0 = authProvider() === "auth0";
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12">
      <Link href="/" aria-label="InterviewMax home" className="text-2xl">
        <Wordmark />
      </Link>
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Sign in to InterviewMax
        </h1>
        <p className="mt-1 text-slate-600">
          {auth0 ? "We'll email you a sign-in code." : "We'll email you a sign-in link."}
        </p>
        <Suspense fallback={null}>
          <LinkError searchParams={searchParams} auth0={auth0} />
        </Suspense>
        <Suspense fallback={null}>
          <SignInChoices searchParams={searchParams} auth0={auth0} />
        </Suspense>
      </div>
      <PolicyLinks />
    </main>
  );
}

const AUTH0_ERRORS: Record<string, string> = {
  auth0: "Sign-in didn't finish. Try again, or pick another way to sign in.",
  account: "We couldn't open your InterviewMax account after that sign-in. Try again in a moment.",
};

// While the "confirm your email" notice is up, its own buttons are the next step, so the usual
// choices stay out of the way (they'd only sign the same unconfirmed account in again).
async function SignInChoices({
  searchParams,
  auth0,
}: {
  searchParams: PageProps<"/login">["searchParams"];
  auth0: boolean;
}) {
  const { error } = await searchParams;
  if (auth0 && error === "unverified") return null;
  return <div className="mt-6">{auth0 ? <Auth0Buttons /> : <LoginForm />}</div>;
}

// The address isn't confirmed yet, so no account can open (claim_profile only trusts confirmed
// addresses). Auth0 emails a confirmation link to new sign-ups; the session still holds the token
// from before they clicked it, so "Continue" goes back through /auth/login for a fresh one rather
// than leaving this message up until they find their own way there.
async function UnverifiedNotice() {
  const session = await auth0Client().getSession();
  const email = typeof session?.user.email === "string" ? session.user.email : "";
  const linkedin = typeof session?.user.sub === "string" && session.user.sub.startsWith("linkedin|");
  const switchHref = "/auth/logout";
  if (!session) {
    return (
      <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        Your email address isn&apos;t confirmed yet. Check your inbox for the confirmation email,
        click the link in it, then sign in below.
      </p>
    );
  }
  return (
    <div role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900" data-testid="unverified-notice">
      {linkedin ? (
        <p>
          LinkedIn didn&apos;t tell us{" "}
          {email ? <strong className="font-semibold">{email}</strong> : "your email address"} is
          confirmed, so we can&apos;t open your account with it. Sign in with an email code or
          Google using the same address instead.
        </p>
      ) : (
        <>
          <p className="font-semibold">Check your inbox to finish signing up.</p>
          <p className="mt-1">
            We sent a confirmation email to{" "}
            {email ? <strong className="font-semibold">{email}</strong> : "your address"}. Click
            the link in it, then come back here and tap Continue. It can take a minute to arrive;
            check spam too.
          </p>
        </>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {!linkedin && (
          <a
            href="/auth/login?returnTo=%2F"
            className="rounded-xl bg-accent-400 px-4 py-2 font-semibold text-ink-950 hover:bg-accent-300"
          >
            I&apos;ve confirmed it, continue
          </a>
        )}
        <a
          href={switchHref}
          className={
            linkedin
              ? "rounded-xl bg-accent-400 px-4 py-2 font-semibold text-ink-950 hover:bg-accent-300"
              : "rounded-xl px-4 py-2 font-medium text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100"
          }
        >
          {linkedin ? "Choose another way to sign in" : "Use a different email"}
        </a>
      </div>
    </div>
  );
}

async function LinkError({
  searchParams,
  auth0,
}: {
  searchParams: PageProps<"/login">["searchParams"];
  auth0: boolean;
}) {
  const { error } = await searchParams;
  if (!error) return null;
  if (auth0 && error === "unverified") return <UnverifiedNotice />;
  if (auth0) {
    const message =
      AUTH0_ERRORS[String(error)] ??
      "That old sign-in link no longer works. Pick a way to sign in below.";
    return (
      <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
        {message}
      </p>
    );
  }
  return (
    <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
      That sign-in link didn&apos;t work or has expired. Request a new one below, then type the
      code from the email instead of clicking the link. Work email security tools sometimes open
      links before you do, which uses them up.
    </p>
  );
}

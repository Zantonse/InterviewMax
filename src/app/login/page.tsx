import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PolicyLinks } from "@/components/policy-links";
import { Wordmark } from "@/components/wordmark";
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
          {auth0 ? "Welcome back. Enter your email to continue." : "We'll email you a sign-in link."}
        </p>
        <Suspense fallback={null}>
          <LinkError searchParams={searchParams} auth0={auth0} />
        </Suspense>
        <div className="mt-6">
          {auth0 ? <Auth0Buttons /> : <LoginForm />}
        </div>
      </div>
      <PolicyLinks />
    </main>
  );
}

const AUTH0_ERRORS: Record<string, string> = {
  verify:
    "Confirm your email address first: open the confirmation email we sent when you created your account and click its link. Then sign in again.",
  auth0: "Sign-in didn't finish. Try again, or pick another way to sign in.",
  account:
    "We couldn't open your InterviewMax account after that sign-in. Your email address has to be confirmed by the service you sign in with; try Google or an email code.",
};

async function LinkError({
  searchParams,
  auth0,
}: {
  searchParams: PageProps<"/login">["searchParams"];
  auth0: boolean;
}) {
  const { error } = await searchParams;
  if (!error) return null;
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

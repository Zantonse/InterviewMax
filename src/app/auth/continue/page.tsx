import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Sign in · InterviewMax",
  robots: { index: false, follow: false },
};

// The magic link lands here instead of signing in straight away, so a mail
// scanner that opens the link can't use it up. See /auth/confirm.
export default function ContinuePage({ searchParams }: PageProps<"/auth/continue">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-wide text-navy-700">InterviewMax</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
          One more click
        </h1>
        <p className="mt-2 text-slate-600">Confirm it&apos;s you and we&apos;ll sign you in.</p>
        <Suspense fallback={null}>
          <ContinueForm searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function ContinueForm({
  searchParams,
}: {
  searchParams: PageProps<"/auth/continue">["searchParams"];
}) {
  const params = await searchParams;
  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : "";
  const type = typeof params.type === "string" ? params.type : "email";

  if (!tokenHash) {
    return (
      <p role="alert" className="mt-6 rounded-xl bg-red-50 p-3 text-sm text-red-800">
        This sign-in link is missing a piece.{" "}
        <a href="/login" className="font-semibold underline">
          Request a new one
        </a>
        .
      </p>
    );
  }

  return (
    <form method="post" action="/auth/confirm" className="mt-6">
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <button
        type="submit"
        className="w-full rounded-xl bg-navy-800 px-4 py-3 font-semibold text-white transition hover:bg-navy-900"
      >
        Continue to InterviewMax
      </button>
    </form>
  );
}

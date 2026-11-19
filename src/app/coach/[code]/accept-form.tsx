"use client";

import Link from "next/link";
import { useActionState } from "react";
import { accept, type AcceptState } from "./actions";

export function AcceptForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(accept, null);
  return (
    <form action={action} className="mt-6" data-testid="accept-form">
      <input type="hidden" name="code" value={code} />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-ink-800 px-5 py-2.5 font-semibold text-white hover:bg-ink-900 disabled:opacity-60"
          data-testid="accept-coaching"
        >
          {pending ? "Saving…" : "Yes, coach me"}
        </button>
        <Link href="/" className="rounded-xl px-4 py-2.5 font-medium text-slate-600 hover:bg-slate-100">
          Not now
        </Link>
      </div>
      {state?.error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

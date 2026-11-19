"use client";

import { useActionState } from "react";
import { CopyButton } from "@/components/copy-button";
import { INVITE_DAYS, MAX_LABEL_LENGTH } from "@/lib/coaching/invite-code";
import { makeInvite, type InviteState } from "./actions";

// Makes a one-time invite link for one person. The link shows here once: only its hash is kept.
export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(makeInvite, null);

  return (
    <div data-testid="invite-form">
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="block text-sm font-semibold text-slate-900">Who is it for?</span>
          <input
            name="label"
            required
            maxLength={MAX_LABEL_LENGTH}
            placeholder="Kevin"
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-ink-700 focus:outline-none"
            data-testid="invite-label"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-ink-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-900 disabled:opacity-60"
          data-testid="invite-make"
        >
          {pending ? "Making the link…" : "Make an invite link"}
        </button>
      </form>
      {state?.error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}
      {state?.link && (
        <div className="mt-4 animate-enter rounded-2xl bg-ink-50 p-4" data-testid="invite-link">
          <p className="text-sm font-semibold text-ink-900">Send this link to {state.label}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-sm text-slate-800 ring-1 ring-slate-200">
              {state.link}
            </code>
            <CopyButton
              text={state.link}
              label="Copy link"
              className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-ink-800 ring-1 ring-ink-200 hover:bg-ink-100"
            />
          </div>
          <p className="mt-2 text-xs text-slate-600">
            It works once and lasts {INVITE_DAYS} days. Copy it now: it isn&apos;t shown again. If
            it gets lost, cancel it below and make a new one.
          </p>
        </div>
      )}
    </div>
  );
}

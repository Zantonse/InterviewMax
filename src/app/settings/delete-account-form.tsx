"use client";

import { useActionState, useId, useState } from "react";
import { DELETE_CONFIRM_WORD as CONFIRM_WORD } from "@/lib/privacy/contact";
import { deleteAccount, type DeleteState } from "./actions";

// Deletes the account after the person types the confirm word, so it can't happen by one stray tap.
export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccount, null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const id = useId();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-50"
      >
        Delete my account
      </button>
    );
  }

  return (
    <form action={action} className="mt-4 space-y-3" data-testid="delete-account-form">
      <label className="block text-sm font-semibold text-slate-900" htmlFor={id}>
        Type &ldquo;{CONFIRM_WORD}&rdquo; to delete your account and everything in it. This
        can&apos;t be undone.
        <input
          id={id}
          name="confirm"
          autoComplete="off"
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="mt-1 w-full max-w-xs rounded-xl border-0 bg-white px-3 py-2.5 text-slate-900 ring-1 ring-slate-300 focus:ring-2 focus:ring-red-700 focus:outline-none"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending || typed.trim().toLowerCase() !== CONFIRM_WORD}
          className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
        >
          {pending ? "Deleting everything…" : "Delete everything"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
        >
          Keep my account
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

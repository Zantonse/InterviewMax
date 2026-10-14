"use client";

import { useActionState, useState } from "react";
import { sendMagicLink, verifyCode, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, action, pending] = useActionState(sendMagicLink, initial);
  // The send result the person backed out of; a new send gives a new state object.
  const [dismissed, setDismissed] = useState<LoginState | null>(null);

  if (state.status === "sent" && state !== dismissed) {
    return <CodeForm email={state.email} onRestart={() => setDismissed(state)} />;
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-sm font-medium text-slate-700">
        Work or personal email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/20"
      />
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-navy-800 px-4 py-3 font-semibold text-white transition hover:bg-navy-900 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}

function CodeForm({ email, onRestart }: { email: string; onRestart: () => void }) {
  const [state, action, pending] = useActionState(verifyCode, {
    status: "sent",
    email,
  } satisfies LoginState);
  const codeError = state.status === "sent" ? state.codeError : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div role="status" className="rounded-2xl bg-navy-50 p-5 text-navy-900">
        <p className="font-semibold">Check your inbox</p>
        <p className="mt-1 text-sm">
          We sent a sign-in email to <span className="font-medium">{email}</span>. Click the
          link in it, or type the code from the email here.
        </p>
      </div>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="email" value={email} />
        <label htmlFor="code" className="text-sm font-medium text-slate-700">
          Code from the email
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={12}
          required
          placeholder="123456"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg tracking-[0.3em] outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/20"
        />
        {codeError && (
          <p role="alert" className="text-sm text-red-700">
            {codeError}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-navy-800 px-4 py-3 font-semibold text-white transition hover:bg-navy-900 disabled:opacity-60"
        >
          {pending ? "Checking…" : "Sign in with code"}
        </button>
      </form>
      <button
        type="button"
        onClick={onRestart}
        className="self-start text-sm font-medium text-navy-700 underline hover:text-navy-900"
      >
        Use a different email or send a new one
      </button>
    </div>
  );
}

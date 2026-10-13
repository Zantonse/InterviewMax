"use client";

import { useFormStatus } from "react-dom";

export function TypeButton({ id, label, blurb }: { id: string; label: string; blurb: string }) {
  const { pending, data } = useFormStatus();
  const starting = pending && data?.get("storyType") === id;
  return (
    <button
      type="submit"
      name="storyType"
      value={id}
      disabled={pending}
      className="group rounded-3xl bg-white p-6 text-left shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:ring-teal-700/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 disabled:translate-y-0 disabled:opacity-70"
    >
      <span className="block text-lg font-bold text-slate-900 group-hover:text-teal-900">
        {label}
      </span>
      <span className="mt-2 block text-slate-600">{starting ? "Starting…" : blurb}</span>
    </button>
  );
}

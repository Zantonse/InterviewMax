"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";

const CARD =
  "group rounded-3xl bg-white p-6 text-left shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:ring-teal-700/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 disabled:translate-y-0 disabled:opacity-70";

export function TypeButton({
  id,
  label,
  blurb,
  badge,
  href,
  locked,
}: {
  id: string;
  label: string;
  blurb: string;
  badge?: string;
  // Opens an existing story instead of starting a new one.
  href?: string;
  locked?: boolean;
}) {
  const { pending, data } = useFormStatus();
  const starting = pending && data?.get("storyType") === id;

  const body = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="block text-lg font-bold text-slate-900 group-hover:text-teal-900">
          {label}
        </span>
        {badge && (
          <span className="shrink-0 rounded-full bg-teal-800 px-2.5 py-1 text-xs font-semibold text-white">
            {badge}
          </span>
        )}
      </span>
      <span className="mt-2 block text-slate-600">{starting ? "Starting…" : blurb}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={CARD} data-testid={`type-${id}`}>
        {body}
      </Link>
    );
  }
  if (locked) {
    return (
      <div
        className="rounded-3xl bg-white/60 p-6 text-left ring-1 ring-black/5"
        aria-disabled="true"
        data-testid={`type-${id}`}
      >
        <span className="block text-lg font-bold text-slate-500">{label}</span>
        <span className="mt-2 block text-sm text-slate-500">{blurb}</span>
      </div>
    );
  }
  return (
    <button
      type="submit"
      name="storyType"
      value={id}
      disabled={pending}
      className={CARD}
      data-testid={`type-${id}`}
    >
      {body}
    </button>
  );
}

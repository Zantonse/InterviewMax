"use client";

import { useEffect, useState } from "react";

// A short "How this works" under a page's title: what to do here, what you get, and what comes
// next. It opens by itself the first time someone visits the page, then stays one tap away, so
// guidance is there for new users without crowding the page for everyone else.
export function PageGuide({ id, steps }: { id: string; steps: React.ReactNode[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const key = `imx-guide-${id}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "seen");
    } catch {
      return;
    }
    // Opens once, after the first paint, on the first visit only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, [id]);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="group mt-2 max-w-2xl"
      data-testid={`guide-${id}`}
    >
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-navy-800 hover:underline [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="flex size-4 items-center justify-center rounded-full bg-navy-800 text-[0.625rem] font-bold text-white"
        >
          ?
        </span>
        How this works
        <span aria-hidden className="text-xs transition group-open:rotate-180">
          ▾
        </span>
      </summary>
      <ol className="mt-3 grid gap-2 rounded-2xl bg-white/80 p-4 text-sm text-slate-700 ring-1 ring-navy-800/10 sm:grid-cols-3 sm:gap-4">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-navy-950">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}

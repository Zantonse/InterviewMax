"use client";

import { useState } from "react";
import { COPY_FAILED, copyText } from "@/lib/clipboard";

// A Copy button that says when copying didn't work, instead of failing silently.
export function CopyButton({
  text,
  className,
  label = "Copy",
}: {
  text: string | (() => string);
  className: string;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    const ok = await copyText(typeof text === "function" ? text() : text);
    setState(ok ? "copied" : "failed");
    if (ok) setTimeout(() => setState((s) => (s === "copied" ? "idle" : s)), 2000);
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" onClick={copy} className={className} data-testid="copy-button">
        {/* The label crossfades (with a slight blur) rather than snapping to "Copied". */}
        <span key={state === "copied" ? "copied" : "idle"} className="inline-block animate-swap">
          {state === "copied" ? "Copied" : label}
        </span>
      </button>
      {state === "failed" && (
        <span role="alert" className="max-w-56 animate-enter text-right text-xs font-medium text-red-700">
          {COPY_FAILED}
        </span>
      )}
    </span>
  );
}

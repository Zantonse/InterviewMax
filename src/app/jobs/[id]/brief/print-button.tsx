"use client";

// Prints the brief; the sidebar and buttons are hidden on paper.
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl px-4 py-2.5 font-semibold text-ink-800 ring-1 ring-ink-800/20 transition hover:bg-ink-50"
    >
      Print
    </button>
  );
}

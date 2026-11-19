import type { KeyboardEvent } from "react";

// Ctrl or ⌘ + Enter sends the form a box sits in, the same keys as the story builder and practice
// (design comparison 2026-11-17, pattern 5: answer a whole flow without reaching for the mouse).
// Plain Enter still makes a new line.
export function isSendKey(e: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey">): boolean {
  return e.key === "Enter" && (e.metaKey || e.ctrlKey);
}

export function submitOnSendKey(e: KeyboardEvent<HTMLTextAreaElement>): void {
  if (!isSendKey(e)) return;
  const form = e.currentTarget.form;
  if (!form) return;
  e.preventDefault();
  form.requestSubmit();
}

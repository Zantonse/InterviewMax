// Checks shared by every answer box, on the page and again in the server action.

// True when the text has at least one letter or digit, in any language. An answer of only emoji,
// punctuation or symbols ("👍", "...", "🙂🙂") gives the coach nothing to work with, and used to
// be saved and then treated as if no answer had been given.
export function hasWords(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}

export const NO_WORDS_MESSAGE = "Add a few words. Emoji or symbols on their own can't be read as an answer.";

// How many characters an answer is over its limit (0 when it fits). Answer boxes no longer cut
// text at the limit (pasting a long answer used to lose its end mid-word with no warning): they
// let it in, say how much to trim, and hold the send button until it fits.
export function overLimit(text: string, max: number): number {
  return Math.max(0, text.trim().length - max);
}

// The one problem, if any, that stops this answer from being sent; null when it can go.
export function answerProblem(text: string, max: number): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null; // Empty: the send button is simply off, no message needed.
  const over = overLimit(trimmed, max);
  if (over > 0) {
    return `That's ${over.toLocaleString("en-US")} character${over === 1 ? "" : "s"} over the ${max.toLocaleString("en-US")} limit. Trim it a little to send.`;
  }
  if (!hasWords(trimmed)) return NO_WORDS_MESSAGE;
  return null;
}

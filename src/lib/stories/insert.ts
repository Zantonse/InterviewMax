export type Insert = { text: string; n: number; remove?: boolean };

// The answer box after a tapped starter: added at the end, or taken out when tapped again. Tapping
// one that's already in the box adds nothing.
export function applyInsert(text: string, insert: Insert): string {
  const piece = insert.text.trim();
  if (insert.remove) {
    const at = text.indexOf(piece);
    if (at < 0) return text;
    return (text.slice(0, at) + text.slice(at + piece.length)).replace(/\n{3,}/g, "\n\n").trim();
  }
  if (text.includes(piece)) return text;
  return text.trim() ? `${text.trimEnd()}\n${insert.text}` : insert.text;
}

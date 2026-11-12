// `replace`: text taken out first, so picking another option in a one-pick row swaps it.
export type Insert = { text: string; n: number; remove?: boolean; replace?: string };

// The answer box after a tapped starter: added at the end, or taken out when tapped again. Tapping
// one that's already in the box adds nothing.
export function applyInsert(text: string, insert: Insert): string {
  if (insert.replace) {
    const swapped = applyInsert(text, { text: insert.replace, n: insert.n, remove: true });
    return applyInsert(swapped, { text: insert.text, n: insert.n, remove: insert.remove });
  }
  const piece = insert.text.trim();
  if (insert.remove) {
    const at = text.indexOf(piece);
    if (at < 0) return text;
    return (text.slice(0, at) + text.slice(at + piece.length)).replace(/\n{3,}/g, "\n\n").trim();
  }
  if (text.includes(piece)) return text;
  return text.trim() ? `${text.trimEnd()}\n${insert.text}` : insert.text;
}

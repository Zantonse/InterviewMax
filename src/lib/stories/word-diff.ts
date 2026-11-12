// A word-level diff of two versions of a story part, for the before and after of a level-up: what
// was added, what was cut, and what stayed. Plain longest-common-subsequence on words; story parts
// are a few sentences, so the quadratic table is tiny.

export type DiffPiece = { kind: "same" | "added" | "cut"; text: string };

// Longest part, in words, worth diffing word by word. Past this the whole part is shown as
// replaced, so a long rewrite can't make the page slow.
const MAX_WORDS = 600;

export function wordDiff(before: string, after: string): DiffPiece[] {
  const a = tokens(before);
  const b = tokens(after);
  if (a.length === 0 && b.length === 0) return [];
  if (a.length > MAX_WORDS || b.length > MAX_WORDS) {
    return merge([
      ...(a.length ? [{ kind: "cut" as const, text: a.join(" ") }] : []),
      ...(b.length ? [{ kind: "added" as const, text: b.join(" ") }] : []),
    ]);
  }
  // lcs[i][j]: length of the longest common run of a[i..] and b[j..].
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] =
        same(a[i], b[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: DiffPiece[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (same(a[i], b[j])) {
      out.push({ kind: "same", text: b[j] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ kind: "cut", text: a[i++] });
    } else {
      out.push({ kind: "added", text: b[j++] });
    }
  }
  while (i < a.length) out.push({ kind: "cut", text: a[i++] });
  while (j < b.length) out.push({ kind: "added", text: b[j++] });
  return readable(merge(out));
}

// Words kept between two changes are folded into the change when the run is this short, so a
// rewritten sentence reads as one cut and one addition, not a patchwork around "to" and "the".
const MIN_KEPT_RUN = 3;

function readable(pieces: DiffPiece[]): DiffPiece[] {
  const out: DiffPiece[] = [];
  let cut: string[] = [];
  let added: string[] = [];
  const flush = () => {
    if (cut.length) out.push({ kind: "cut", text: cut.join(" ") });
    if (added.length) out.push({ kind: "added", text: added.join(" ") });
    cut = [];
    added = [];
  };
  pieces.forEach((p, i) => {
    const between = i > 0 && i < pieces.length - 1;
    if (p.kind === "same" && !(between && tokens(p.text).length < MIN_KEPT_RUN)) {
      flush();
      out.push(p);
    } else if (p.kind === "same") {
      cut.push(p.text);
      added.push(p.text);
    } else if (p.kind === "cut") {
      cut.push(p.text);
    } else {
      added.push(p.text);
    }
  });
  flush();
  return out;
}

function tokens(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

// Words match ignoring case and trailing punctuation, so "launch." and "launch," count as kept.
function same(x: string, y: string): boolean {
  return norm(x) === norm(y);
}

function norm(word: string): string {
  return word.toLowerCase().replace(/[.,;:!?)"'”’]+$/u, "").replace(/^[("'“‘]+/u, "");
}

// Joins runs of the same kind into one piece.
function merge(pieces: DiffPiece[]): DiffPiece[] {
  const out: DiffPiece[] = [];
  for (const p of pieces) {
    const last = out[out.length - 1];
    if (last && last.kind === p.kind) last.text += ` ${p.text}`;
    else out.push({ ...p });
  }
  return out;
}

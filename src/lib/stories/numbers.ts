// The "no invented facts" check: every number in a written story must appear in the user's answers.
// Plain code, no model call. Numbers are compared by value, so "$2.4M", "$2,400,000" and
// "2.4 million" all match each other.

export type FoundNumber = {
  // The text as written, e.g. "$2.4M" or "40%".
  raw: string;
  // The value after scaling, e.g. 2400000.
  value: number;
  // The value before any k/M/B scaling, e.g. 2.4.
  base: number;
};

const SCALES: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  m: 1e6,
  mm: 1e6,
  million: 1e6,
  b: 1e9,
  bn: 1e9,
  billion: 1e9,
};

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  hundred: 100,
  dozen: 12,
  half: 0.5,
  doubled: 2,
  tripled: 3,
};

// "one" and "half" are too common in plain prose to flag in a draft ("one of the…", "half the team").
const DRAFT_WORD_IGNORE = new Set(["one", "half"]);

const DIGIT_RE =
  /(?<![\w.])[$€£]?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(%|x|\s?(?:k|mm|m|bn|b|thousand|million|billion))?(?![\w])/gi;
const WORD_RE = new RegExp(`\\b(${Object.keys(WORD_NUMBERS).join("|")})\\b`, "gi");

export function findNumbers(text: string, { includeCommonWords = true } = {}): FoundNumber[] {
  const found: FoundNumber[] = [];

  for (const match of text.matchAll(DIGIT_RE)) {
    const base = Number(match[1].replace(/,/g, "") + (match[2] ?? ""));
    if (!Number.isFinite(base)) continue;
    const scale = SCALES[(match[3] ?? "").trim().toLowerCase()] ?? 1;
    found.push({ raw: match[0].trim(), value: base * scale, base });
  }

  for (const match of text.matchAll(WORD_RE)) {
    const word = match[1].toLowerCase();
    if (!includeCommonWords && DRAFT_WORD_IGNORE.has(word)) continue;
    const value = WORD_NUMBERS[word];
    found.push({ raw: match[0], value, base: value });
  }

  return found;
}

// Returns the numbers in `draft` that can't be traced to `answers`, as written in the draft.
export function untracedNumbers(draft: string, answers: string): string[] {
  const known = new Set<number>();
  for (const n of findNumbers(answers)) {
    known.add(round(n.value));
    known.add(round(n.base));
  }

  const missing = new Set<string>();
  for (const n of findNumbers(draft, { includeCommonWords: false })) {
    if (!known.has(round(n.value)) && !known.has(round(n.base))) missing.add(n.raw);
  }
  return [...missing];
}

function round(n: number) {
  return Math.round(n * 1e6) / 1e6;
}

// Keeps the sentences of `text` whose numbers all trace to `source`, and drops the rest. Used where
// one stray figure shouldn't cost a whole answer, e.g. answers filled in from a LinkedIn profile.
export function keepTracedSentences(text: string, source: string): string {
  return text
    .split("\n")
    .map((line) =>
      line
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) => untracedNumbers(sentence, source).length === 0)
        .join(" "),
    )
    .filter((line) => line.trim())
    .join("\n")
    .trim();
}

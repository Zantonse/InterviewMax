// The "no invented facts" check: every number in a written story must appear in the user's answers.
// Plain code, no model call. Numbers are compared by value, so "$2.4M", "$2,400,000" and
// "2.4 million" all match each other. A percent or a money figure must also trace to a number the
// user gave as that kind of figure (or with no unit at all): "46 deals" in the answers doesn't make
// "46%" in the story theirs. A persona's "win rate rose 15%" came back as "from about 31% to about
// 46%" (sims run 30, 2026-11-12) and passed on value alone.

// What a number counts: a percent, money, a multiple ("2x"), things ("46 deals"), or nothing said.
export type NumberUnit = "percent" | "money" | "multiple" | "count" | "plain";

export type FoundNumber = {
  // The text as written, e.g. "$2.4M" or "40%".
  raw: string;
  // The value after scaling, e.g. 2400000.
  value: number;
  // The value before any k/M/B scaling, e.g. 2.4.
  base: number;
  unit: NumberUnit;
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

// What comes right after a number and says what it is.
const PERCENT_AFTER_RE = /^\s*(?:per\s?cent|pct\b|percentage\s+points?\b|points?\b|pts\b|pp\b)/i;
const MONEY_AFTER_RE = /^\s*(?:dollars|usd|euros?|eur|pounds|gbp)\b/i;
// A word after a number that names what was counted ("46 deals"), unless it only joins clauses or
// another number ("31 to 46%", "3 of them", "10 weeks in").
const COUNT_AFTER_RE = /^\s+([a-z][a-z'-]*)/i;
const NOT_A_NOUN = new Set([
  "to", "and", "or", "of", "in", "on", "at", "by", "for", "from", "with", "than", "per", "a", "an",
  "the", "is", "was", "were", "are", "it", "that", "this", "so", "but", "as", "out", "up", "down",
  "over", "under", "about", "around", "roughly", "more", "less", "fewer", "ish",
]);
// "31 to 46%", "31-46%", "31 or 32%": the first number shares the unit of the second.
const RANGE_GAP_RE = /^\s*(?:to|and|or|-|–|—)\s*$/i;

function unitAfter(after: string, suffix: string, currency: boolean): NumberUnit {
  if (suffix === "%" || PERCENT_AFTER_RE.test(after)) return "percent";
  if (currency || MONEY_AFTER_RE.test(after)) return "money";
  if (suffix.toLowerCase() === "x") return "multiple";
  const word = after.match(COUNT_AFTER_RE)?.[1]?.toLowerCase();
  if (word && !NOT_A_NOUN.has(word)) return "count";
  return "plain";
}

export function findNumbers(text: string, { includeCommonWords = true } = {}): FoundNumber[] {
  const found: (FoundNumber & { start: number; end: number })[] = [];

  for (const match of text.matchAll(DIGIT_RE)) {
    const base = Number(match[1].replace(/,/g, "") + (match[2] ?? ""));
    if (!Number.isFinite(base)) continue;
    const suffix = (match[3] ?? "").trim();
    const scale = SCALES[suffix.toLowerCase()] ?? 1;
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const unit = unitAfter(text.slice(end, end + 40), suffix, /^[$€£]/.test(match[0]));
    found.push({ raw: match[0].trim(), value: base * scale, base, unit, start, end });
  }

  for (const match of text.matchAll(WORD_RE)) {
    const word = match[1].toLowerCase();
    if (!includeCommonWords && DRAFT_WORD_IGNORE.has(word)) continue;
    const value = WORD_NUMBERS[word];
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const unit = unitAfter(text.slice(end, end + 40), "", false);
    found.push({ raw: match[0], value, base: value, unit, start, end });
  }

  // A bare number in a range takes the unit of the number it runs to: "from 31 to 46%".
  found.sort((a, b) => a.start - b.start);
  for (let i = found.length - 2; i >= 0; i--) {
    const [a, b] = [found[i], found[i + 1]];
    if (a.unit === "plain" && b.unit !== "plain" && RANGE_GAP_RE.test(text.slice(a.end, b.start))) {
      a.unit = b.unit;
    }
  }

  return found.map(({ raw, value, base, unit }) => ({ raw, value, base, unit }));
}

// Whether a figure the user gave can stand behind a figure in the story. A number with no unit
// backs anything of that value; a percent backs only a percent, and money only money.
function backs(given: NumberUnit, used: NumberUnit): boolean {
  if (given === "plain") return true;
  if (used === "percent" || used === "money") return given === used;
  if (given === "percent" || given === "money") return used === "plain";
  return true;
}

// Returns the numbers in `draft` that can't be traced to `answers`, as written in the draft.
export function untracedNumbers(draft: string, answers: string): string[] {
  // Each value the user gave, with every unit they gave it in.
  const known = new Map<number, Set<NumberUnit>>();
  const add = (value: number, unit: NumberUnit) => {
    const key = round(value);
    const units = known.get(key) ?? new Set<NumberUnit>();
    units.add(unit);
    known.set(key, units);
  };
  for (const n of findNumbers(answers)) {
    add(n.value, n.unit);
    add(n.base, n.unit);
  }

  const traced = (value: number, unit: NumberUnit) =>
    [...(known.get(round(value)) ?? [])].some((given) => backs(given, unit));

  const missing = new Set<string>();
  for (const n of findNumbers(draft, { includeCommonWords: false })) {
    if (!traced(n.value, n.unit) && !traced(n.base, n.unit)) missing.add(n.raw);
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

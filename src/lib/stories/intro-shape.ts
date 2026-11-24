// "Tell me about yourself": checks on the shape of a written introduction, in code. Each problem
// comes back as an ask for the writer's retry (see writeChecked in builder.ts).
//
// From Craig's own About me (Nov 22): the path listed five stops in one sentence, the opening said
// "as an IC" instead of the reps and accounts he supports, his own through-line ("started moving
// more customer facing") was dropped, and "300 or 80%" was copied as said.

// Mixed-case names after the first word of a sentence: companies and products ("AirWatch",
// "OneLogin"). All-caps acronyms ("BIOS", "SE") and "I" aren't stops.
const NAME_RE = /(?<![.!?]\s|^)\b[A-Z][A-Za-z]*[a-z][A-Za-z]*\b/g;
const NOT_NAMES = new Set(["I", "I'm", "I've", "I'd"]);

export function pathStops(path: string): string[] {
  const names = new Set<string>();
  for (const m of path.trim().matchAll(NAME_RE)) {
    if (!NOT_NAMES.has(m[0])) names.add(m[0]);
  }
  return [...names];
}

function sentences(text: string): number {
  return text
    .split(/[.!?]+(?:\s|$)/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

// The opening leads with what an individual contributor doesn't do.
const IC_LABEL_RE = /\b(as an IC|as an individual contributor|I don't manage (?:anyone|people|a team))\b/i;

// The direction a career kept moving in, as the user said it ("moving more customer facing",
// "closer to the customer").
const DIRECTION_RE =
  /\b(?:mov(?:e|ed|ing)|shift(?:ed|ing)?|gr[eo]w(?:ing)?|g[eo]t(?:ting)?)\s+(?:more|closer)\s+(?:to\s+|into\s+|toward\s+|towards\s+)?(?:the\s+)?([a-z]+(?:[ -][a-z]+)?)/gi;
const DIRECTION_FILLER = new Set(["a", "an", "the", "on", "to", "into", "over", "from", "with", "and"]);

export function directionPhrase(answer: string): { phrase: string; key: string } | undefined {
  for (const m of answer.matchAll(DIRECTION_RE)) {
    const words = m[1].toLowerCase().split(/[ -]/).filter(Boolean);
    // "moving more customer facing, with a…": stop at a filler word.
    const cut = words.findIndex((w) => DIRECTION_FILLER.has(w));
    const kept = cut < 0 ? words : words.slice(0, cut);
    if (kept.length === 0) continue;
    const phrase = m[0].trim().split(/\s+/);
    return { phrase: phrase.slice(0, phrase.length - (words.length - kept.length)).join(" "), key: kept.join(" ") };
  }
  return undefined;
}

function squash(text: string): string {
  return text.toLowerCase().replace(/[-–—]/g, " ").replace(/\s+/g, " ");
}

// One figure said two ways ("300 or 80%").
const TWO_WAYS_RE = /\b\d[\d,.]*%?\s+or\s+\d[\d,.]*%/;

export const MAX_PATH_STOPS = 3;

export function introShapeProblems(
  parts: Record<string, string>,
  answers: { path?: string },
): string[] {
  const problems: string[] = [];
  const path = parts.path ?? "";
  const stops = pathStops(path);
  const thens = path.match(/\bthen\b/gi)?.length ?? 0;
  if (stops.length > MAX_PATH_STOPS || thens >= 2 || sentences(path) > 2) {
    problems.push(
      `"How I got here" reads like a list of jobs (${stops.length ? stops.join(", ") : `${sentences(path)} sentences`}). Build it on the one move that mattered most and why I made it, in my words, and name at most two other stops in passing. Two sentences at most.`,
    );
  }
  const direction = answers.path ? directionPhrase(answers.path) : undefined;
  if (direction && !squash(path).includes(direction.key)) {
    problems.push(
      `I said "${direction.phrase}". That's the thread of my career, so keep that phrase in "How I got here".`,
    );
  }
  const label = (parts.present ?? "").match(IC_LABEL_RE);
  if (label) {
    problems.push(
      `The opening says "${label[0]}", which leads with what I don't do. Say what I own and who relies on it instead, from my answers.`,
    );
  }
  const twoWays = Object.values(parts).join("\n").match(TWO_WAYS_RE);
  if (twoWays) {
    problems.push(
      `"${twoWays[0]}" says one figure two ways. Say it once with its context (e.g. "300 SEs, 80% of the team"), using only my figures.`,
    );
  }
  return problems;
}

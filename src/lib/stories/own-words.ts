// "In your words": how much of a written story is in the user's own phrasing. Plain code, no model
// call. A word counts as theirs when it sits in a run of three or more words that also appears, in
// the same order, somewhere in their answers. Tester feedback (Oct 16): rewrites read as robotic and
// lost what the user actually said; a coach edits the telling instead of rewriting it.
//
// Calibrated on Craig's About me (Oct 17): the draft he kept scores 0.39; a corporate rewrite of the
// same facts ("spearheading AI enablement", "quota attainment") scores 0.09.

// Below this, the writer is sent back to rework the draft from the user's words, and the quick
// check flags it.
export const OWN_WORDS_MIN = 0.25;

const RUN = 3;

export function ownWordsShare(draft: string, answers: string): number {
  const said = words(draft);
  if (said.length === 0) return 0;
  const theirs = words(answers);
  const runs = new Set<string>();
  for (let i = 0; i + RUN <= theirs.length; i++) runs.add(theirs.slice(i, i + RUN).join(" "));
  const covered = new Array<boolean>(said.length).fill(false);
  for (let i = 0; i + RUN <= said.length; i++) {
    if (!runs.has(said.slice(i, i + RUN).join(" "))) continue;
    for (let j = i; j < i + RUN; j++) covered[j] = true;
  }
  return covered.filter(Boolean).length / said.length;
}

// Lowercased words, with curly apostrophes straightened so "I’m" matches "I'm". Punctuation between
// words is dropped, so a run can cross a comma the writer added; "4.3M" stays one word.
function words(text: string): string[] {
  return text
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .match(/[a-z0-9$%']+(?:\.[a-z0-9]+)*/g) ?? [];
}

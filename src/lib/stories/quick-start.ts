import type { StoryTypeId } from "./story-types";

// "Quick start" under a behavioral story's opening question: three rows of taps (what was at stake,
// their part, how it ended) that start the answer as a few lines of notes, so the box isn't blank.
// One pick per row. The words are short, plain and never a figure, because a tapped line counts as
// the user's own words (see cleanOptions in content.ts). The model doesn't see these as anything
// but the start of their answer.

export type QuickRow = { id: string; label: string; options: readonly string[] };

const STAKES: QuickRow = {
  id: "stakes",
  label: "At stake",
  options: ["A customer", "Money", "A deadline", "My team"],
};

const PART: QuickRow = {
  id: "part",
  label: "My part",
  options: ["I led it", "I owned one piece", "I stepped in unasked"],
};

const ENDING: QuickRow = {
  id: "ending",
  label: "How it ended",
  options: ["It worked", "Mixed", "It went wrong"],
};

const ENDING_BY_TYPE: Partial<Record<StoryTypeId, QuickRow>> = {
  went_wrong: {
    id: "ending",
    label: "How it ended",
    options: ["I fixed it", "Partly saved", "It stayed broken"],
  },
  difficult_stakeholder: {
    id: "ending",
    label: "How it ended",
    options: ["We agreed", "Met halfway", "Still at odds"],
  },
};

export function quickStartRows(storyTypeId: string | null | undefined): QuickRow[] {
  const ending = ENDING_BY_TYPE[storyTypeId as StoryTypeId] ?? ENDING;
  return [STAKES, PART, ending];
}

// The line one pick adds to the answer, e.g. "At stake: A customer. "
export function quickLine(row: QuickRow, option: string): string {
  return `${row.label}: ${option}. `;
}

// Which option of a row is in the answer now, if any.
export function quickPicked(row: QuickRow, answer: string): string | undefined {
  return row.options.find((o) => answer.includes(quickLine(row, o).trim()));
}

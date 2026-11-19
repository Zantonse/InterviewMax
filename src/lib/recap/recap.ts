import type { PracticeItem } from "@/lib/practice/content";
import { themeCounts } from "@/lib/stories/bank";
import { hasDraft, type StoryContent } from "@/lib/stories/content";
import { storyLevel, type StoryLevel } from "@/lib/stories/levels";
import { getStoryType } from "@/lib/stories/story-types";

// "Your prep so far": a card the user can save as an image and share, like a year-in-review. Big
// numbers and a name for the kind of stories they tell, read from their own story bank. Plain code,
// no model call, and nothing inferred about the person: the name comes from which question theme
// most of their written stories answer.

type StoryLike = { id: string; title: string; storyType: string | null; content: StoryContent };

// What a story bank leaning toward each theme is called on the card.
export const THEME_NAMES: Record<string, { name: string; line: string }> = {
  impact: { name: "Results Driver", line: "Most of your stories end in a result you can count." },
  ownership: { name: "Owner", line: "Most of your stories are about taking something on yourself." },
  conflict: { name: "Peacemaker", line: "Most of your stories turn a hard conversation around." },
  influence: { name: "Persuader", line: "Most of your stories win people over without authority." },
  failure: { name: "Comeback Teller", line: "Most of your stories learn from something going wrong." },
  prioritization: { name: "Decision Maker", line: "Most of your stories make a hard call." },
  collaboration: { name: "Connector", line: "Most of your stories bring teams together." },
  ambiguity: { name: "Navigator", line: "Most of your stories find a way through change." },
  success: { name: "Measurer", line: "Most of your stories define what good looks like." },
  ai_use: { name: "AI Pragmatist", line: "Most of your stories put AI to work, carefully." },
};

export type Recap = {
  name: string;
  line: string;
  stats: { value: number; label: string }[];
  // The highest-level written story.
  best?: { title: string; level: StoryLevel };
  // The first question theme with no story yet.
  nextGap?: string;
};

// Null until there's a written behavioral story: there's nothing to recap yet.
export function buildRecap(
  stories: StoryLike[],
  sessions: { items: PracticeItem[] }[],
): Recap | null {
  const written = stories.filter((s) => hasDraft(s.content));
  const behavioral = written.filter((s) => getStoryType(s.storyType)?.format === "star");
  if (behavioral.length === 0) return null;

  const counts = themeCounts(stories).filter((c) => c.id !== "about_you");
  const top = counts.find((c) => c.written > 0 && THEME_NAMES[c.id]);
  const named = top ? THEME_NAMES[top.id] : { name: "Storyteller", line: "Your stories are taking shape." };

  const levelled = behavioral
    .map((s) => ({ s, level: storyLevel(s.content, getStoryType(s.storyType)) }))
    .filter((x): x is { s: StoryLike; level: StoryLevel } => x.level !== undefined);
  const ready = levelled.filter((x) => x.level >= 2).length;
  const best = levelled.reduce<(typeof levelled)[number] | undefined>(
    (b, x) => (!b || x.level > b.level ? x : b),
    undefined,
  );
  const practised = sessions.reduce(
    (sum, session) => sum + session.items.filter((i) => i.feedback).length,
    0,
  );
  const gap = counts.find((c) => c.status === "empty");

  return {
    name: named.name,
    line: named.line,
    stats: [
      { value: written.length, label: written.length === 1 ? "story written" : "stories written" },
      { value: ready, label: "at Level 2 or up" },
      { value: practised, label: practised === 1 ? "answer said out loud" : "answers said out loud" },
    ],
    ...(best ? { best: { title: best.s.title, level: best.level } } : {}),
    ...(gap ? { nextGap: gap.label } : {}),
  };
}

// The card as plain text, for pasting into a message.
export function recapText(recap: Recap): string {
  return [
    `My interview prep so far: ${recap.name}`,
    recap.line,
    ...recap.stats.map((s) => `${s.value} ${s.label}`),
    ...(recap.best ? [`Best story: ${recap.best.title} (Level ${recap.best.level})`] : []),
    "Made with InterviewMax",
  ].join("\n");
}

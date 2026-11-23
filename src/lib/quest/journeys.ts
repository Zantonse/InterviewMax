// Story Quest journeys: short paths through the builder, each with one clear next step. Plain
// logic, safe to import in client components.

import { LEVEL_XP, QUEST_LEVEL_NAMES, isQuestStory, questLevel, type QuestLevel, type QuestStory } from "./xp";

export type StepState = "done" | "now" | "locked";

export type JourneyStep = { id: string; label: string; xp: number; state: StepState };

export type Cta = { href: string; label: string };

export type Journey = {
  id: string;
  title: string;
  // One line on what it is.
  blurb: string;
  steps: JourneyStep[];
  done: boolean;
  // The one next thing to do; missing once the journey is done.
  next?: Cta;
  // The story the journey is working on, when there is one.
  storyId?: string;
  storyTitle?: string;
};

function withStates<T extends { id: string; label: string; xp: number }>(
  steps: T[],
  doneCount: number,
): JourneyStep[] {
  return steps.map((s, i) => ({
    id: s.id,
    label: s.label,
    xp: s.xp,
    state: i < doneCount ? "done" : i === doneCount ? "now" : "locked",
  }));
}

// The story "Your first story" works on: one already said out loud (the journey is done), else the
// one furthest along, the most recently touched on a tie.
export function focusStory(
  stories: readonly QuestStory[],
  aloud: ReadonlySet<string>,
): { story: QuestStory; level: QuestLevel } | undefined {
  const ranked = stories
    .filter(isQuestStory)
    .map((story) => ({ story, level: questLevel(story, aloud) }))
    .sort(
      (a, b) =>
        b.level - a.level || (b.story.updatedAt ?? "").localeCompare(a.story.updatedAt ?? ""),
    );
  return ranked[0];
}

// "Your first story": pick a question, tell it, then climb Level 2, 3 and 4. `practiceHref` is where
// the story can be practiced (the practice page of a job whose questions it answers).
export function firstStoryJourney(
  stories: readonly QuestStory[],
  aloud: ReadonlySet<string>,
  practiceHref = "/practice",
): Journey {
  const focus = focusStory(stories, aloud);
  const level = focus?.level ?? 0;
  const steps = [
    { id: "pick", label: "Pick a question", xp: 0 },
    { id: "level1", label: "Tell it rough · Level 1", xp: LEVEL_XP[1] },
    { id: "level2", label: "Add stakes and a number · Level 2", xp: LEVEL_XP[2] },
    { id: "level3", label: "Show your thinking · Level 3", xp: LEVEL_XP[3] },
    { id: "level4", label: "Say it out loud · Level 4", xp: LEVEL_XP[4] },
  ];
  const doneCount = focus ? 1 + level : 0;
  const done = level >= 4;
  const href = focus ? `/stories/${focus.story.id}` : "/stories/new";
  const next: Cta | undefined = done
    ? undefined
    : !focus
      ? { href, label: "Pick a question to start" }
      : level === 0
        ? { href, label: "Finish telling it" }
        : level === 3
          ? { href: practiceHref, label: "Practice it out loud" }
          : { href, label: `Take it to Level ${level + 1}` };
  return {
    id: "first",
    title: "Your first story",
    blurb: done
      ? "Done: your first story is ready to say out loud."
      : focus
        ? `Working on “${focus.story.title || "Untitled story"}”, now at ${level === 0 ? "a first telling" : `Level ${level}: ${QUEST_LEVEL_NAMES[level]}`}.`
        : "One story, from a rough telling to ready to say out loud.",
    steps: withStates(steps, doneCount),
    done,
    next,
    ...(focus ? { storyId: focus.story.id, storyTitle: focus.story.title } : {}),
  };
}

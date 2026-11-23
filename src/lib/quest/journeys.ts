// Story Quest journeys: short paths through the builder, each with one clear next step. Plain
// logic, safe to import in client components.

import { CORE_STORY_GOAL } from "@/lib/prep/finish-line";
import { hasDraft } from "@/lib/stories/content";
import { LEARNED, SKILL_LEVELS, weakestSkills, type SkillStatus } from "@/lib/stories/skills";
import {
  LEVEL_XP,
  QUEST_LEVEL_NAMES,
  SKILL_LEARNED_XP,
  isQuestStory,
  questLevel,
  xpForLevel,
  type QuestLevel,
  type QuestStory,
} from "./xp";

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
  // The boss round can start: the card shows its start button instead of a link.
  boss?: { jobId: string };
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

// "The core six": the finish line (finish-line.ts) as a journey. Six written behavioral stories,
// best first, each showing its level and the XP it has earned. `next` is the story the user's jobs
// need next, when the caller knows it.
export function coreSixJourney(
  stories: readonly QuestStory[],
  aloud: ReadonlySet<string>,
  next: Cta = { href: "/stories/new", label: "Start your next story" },
): Journey {
  const written = stories
    .filter((s) => isQuestStory(s) && hasDraft(s.content))
    .map((story) => ({ story, level: questLevel(story, aloud) }))
    .sort((a, b) => b.level - a.level || (b.story.updatedAt ?? "").localeCompare(a.story.updatedAt ?? ""));
  const steps: JourneyStep[] = Array.from({ length: CORE_STORY_GOAL }, (_, i) => {
    const w = written[i];
    if (w) {
      return {
        id: `slot${i + 1}`,
        label: `${w.story.title || "Untitled story"} · Level ${w.level}`,
        xp: xpForLevel(w.level),
        state: "done" as const,
      };
    }
    return {
      id: `slot${i + 1}`,
      label: `Story ${i + 1}`,
      xp: xpForLevel(4),
      state: i === written.length ? ("now" as const) : ("locked" as const),
    };
  });
  const count = Math.min(written.length, CORE_STORY_GOAL);
  const done = count >= CORE_STORY_GOAL;
  // Once six are written, the next step is the lowest of them that can still climb.
  const lowest = done
    ? [...written.slice(0, CORE_STORY_GOAL)].reverse().find((w) => w.level < 4)
    : undefined;
  return {
    id: "six",
    title: "The core six",
    blurb: done
      ? lowest
        ? "All six written. Now take each one to Level 4."
        : "All six are ready to say out loud."
      : `${count} of ${CORE_STORY_GOAL} written. Six stories answer most of what interviewers ask; one a day is enough.`,
    steps,
    done: done && !lowest,
    ...(done
      ? lowest
        ? {
            next:
              lowest.level === 3
                ? { href: "/practice", label: `Practice “${lowest.story.title || "Untitled story"}” out loud` }
                : { href: `/stories/${lowest.story.id}`, label: `Take “${lowest.story.title || "Untitled story"}” to Level ${lowest.level + 1}` },
          }
        : {}
      : { next }),
  };
}

// "Fix your weakest skill": the skills map's weakest skill not yet Learned, shown in one story and
// then again in another before the app asks about it. Opens once a story has been graded.
export function weakestSkillJourney(map: SkillStatus[]): Journey {
  const graded = map.some((s) => s.level > 0);
  // The weakest skill still short of Learned: the one the builder's questions look at first
  // (weakestSkills), else any not yet tried.
  const [skill] = weakestSkills(map, 1);
  const status =
    (skill && map.find((s) => s.skill.id === skill.id)) ||
    map.filter((s) => s.level < LEARNED).sort((a, b) => a.level - b.level)[0];
  const level = status?.level ?? LEARNED;
  const steps = withStates(
    [
      { id: "try", label: `Try it in a story · ${SKILL_LEVELS[1].name}`, xp: 0 },
      { id: "once", label: `Get it to Solid once · ${SKILL_LEVELS[2].name}`, xp: 0 },
      { id: "learned", label: `Show it again before I ask · ${SKILL_LEVELS[3].name}`, xp: SKILL_LEARNED_XP },
    ],
    graded ? Math.min(3, level) : -1,
  );
  if (!graded) {
    return {
      id: "weak",
      title: "Fix your weakest skill",
      blurb: "Opens once one of your stories has been graded, so I can see which skill to work on.",
      steps: steps.map((st) => ({ ...st, state: "locked" })),
      done: false,
    };
  }
  if (!status) {
    return {
      id: "weak",
      title: "Fix your weakest skill",
      blurb: "Every skill is learned. Keep going on the core six.",
      steps,
      done: true,
    };
  }
  return {
    id: "weak",
    title: `Fix your weakest skill: ${status.skill.label.toLowerCase()}`,
    blurb: `${status.skill.what} ${status.next ?? ""}`.trim(),
    steps,
    done: false,
    next: { href: "/stories/new", label: "Start a story to practice it" },
  };
}

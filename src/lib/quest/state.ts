import { LEARNED, skillsMap } from "@/lib/stories/skills";
import type { QuestSession, QuestStory } from "./xp";
import { bossJobsDone } from "./boss";
import { skillTree } from "./tree";
import { questLevel, storiesSaidOutLoud, xpSummary } from "./xp";

// Everything Story Quest shows, worked out once from the user's data. Plain logic.
export function questState(data: {
  stories: readonly QuestStory[];
  sessions: readonly QuestSession[];
  transcripts?: readonly { analysis: unknown }[];
}) {
  const aloud = storiesSaidOutLoud(data.sessions);
  const map = skillsMap([...data.stories]);
  const bossRounds = bossJobsDone(data.sessions).size;
  const xp = xpSummary({
    stories: data.stories,
    sessions: data.sessions,
    transcripts: data.transcripts,
    skillsLearned: map.filter((s) => s.level >= LEARNED).length,
    bossRounds,
  });
  const storiesAtFour = data.stories.filter((s) => questLevel(s, aloud) === 4).length;
  const tree = skillTree({ map, sessions: data.sessions, storiesAtFour, bossRounds });
  return { aloud, map, xp, tree };
}

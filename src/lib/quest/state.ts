import { LEARNED, skillsMap } from "@/lib/stories/skills";
import type { QuestSession, QuestStory } from "./xp";
import { storiesSaidOutLoud, xpSummary } from "./xp";

// Everything Story Quest shows, worked out once from the user's data. Plain logic.
export function questState(data: {
  stories: readonly QuestStory[];
  sessions: readonly QuestSession[];
  transcripts?: readonly { analysis: unknown }[];
}) {
  const aloud = storiesSaidOutLoud(data.sessions);
  const map = skillsMap([...data.stories]);
  const xp = xpSummary({
    stories: data.stories,
    sessions: data.sessions,
    transcripts: data.transcripts,
    skillsLearned: map.filter((s) => s.level >= LEARNED).length,
  });
  return { aloud, map, xp };
}

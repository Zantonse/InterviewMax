import { builderStage } from "@/lib/stories/content";
import { getStoryType, type StoryTypeId } from "@/lib/stories/story-types";
import { getTheme } from "./themes";

type StoryLike = { id: string; title: string; storyType: string | null; content: Parameters<typeof builderStage>[0] };

export type QuestionCoverage =
  // A story in the bank answers it.
  | { kind: "story"; storyId: string; title: string; drafted: boolean }
  // Nothing yet: this is the story type to build for it.
  | { kind: "build"; storyType: StoryTypeId };

// Which of the user's stories answers a question, by its theme. Prefers a written story, then the
// theme's first story type; with none, names the type to build.
export function coverageFor(themeId: string, stories: StoryLike[]): QuestionCoverage | undefined {
  const theme = getTheme(themeId);
  if (!theme) return undefined;
  const candidates = theme.storyTypes.flatMap((typeId) =>
    stories.filter((s) => s.storyType === typeId),
  );
  const drafted = candidates.find(
    (s) => builderStage(s.content, getStoryType(s.storyType)) === "drafted",
  );
  const story = drafted ?? candidates[0];
  if (story) return { kind: "story", storyId: story.id, title: story.title, drafted: Boolean(drafted) };
  return { kind: "build", storyType: theme.storyTypes[0] };
}

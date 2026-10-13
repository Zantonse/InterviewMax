import "server-only";
import { builderStage } from "./content";
import { listStories } from "./data";
import { REQUIRED_STORY_TYPE_ID, getStoryType } from "./story-types";

// Where the signed-in user is with their "Tell me about yourself" story. They keep one.
export async function requiredStoryStatus(): Promise<{
  storyId: string | undefined;
  drafted: boolean;
}> {
  const stories = await listStories();
  const type = getStoryType(REQUIRED_STORY_TYPE_ID);
  const mine = stories.filter((s) => s.storyType === REQUIRED_STORY_TYPE_ID);
  const drafted = mine.find((s) => builderStage(s.content, type) === "drafted");
  // listStories is newest first.
  const story = drafted ?? mine[0];
  return { storyId: story?.id, drafted: Boolean(drafted) };
}

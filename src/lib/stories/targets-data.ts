import "server-only";
import { unstable_rethrow } from "next/navigation";
import { getJobsPrep, listJobs } from "@/lib/jobs/data";
import { listStories } from "./data";
import { REQUIRED_STORY_TYPE_ID, type StoryType } from "./story-types";
import { builderTargets, type BuilderTargets } from "./targets";

// Loads what the user is preparing for, for one story's builder: target jobs, the jobs read, and
// from "Tell me about yourself" the role they want next and where they are now. Optional
// background, so a failure to load any of it never blocks the builder.
export async function loadBuilderTargets(
  storyType: StoryType | undefined,
): Promise<BuilderTargets | undefined> {
  try {
    const intro = storyType?.format === "intro";
    const [jobs, prep, stories] = await Promise.all([
      listJobs(),
      // The jobs read only adds each job's focus; without it the jobs still count.
      getJobsPrep().catch(() => ({ overview: null })),
      // In "Tell me about yourself" itself, the role they want is already one of the answers.
      intro ? Promise.resolve([]) : listStories(),
    ]);
    // listStories is newest first.
    const aboutMe = (answer: string) =>
      stories.find(
        (s) =>
          s.storyType === REQUIRED_STORY_TYPE_ID &&
          Boolean(s.content.answers[answer]?.trim()),
      )?.content.answers[answer];
    return builderTargets({
      jobs,
      focus: prep.overview?.jobs,
      wantedRole: aboutMe("next"),
      // Whether they manage people today (situation.ts).
      currentRole: aboutMe("now"),
      storyType,
    });
  } catch (err) {
    unstable_rethrow(err);
    console.error("Story builder: couldn't load target jobs", err);
    return undefined;
  }
}

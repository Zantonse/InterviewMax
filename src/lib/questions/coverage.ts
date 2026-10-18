import { hasDraft } from "@/lib/stories/content";
import type { StoryTypeId } from "@/lib/stories/story-types";
import { getTheme } from "./themes";

type StoryLike = {
  id: string;
  title: string;
  storyType: string | null;
  content: Parameters<typeof hasDraft>[0];
};

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
  const drafted = candidates.find((s) => hasDraft(s.content));
  const story = drafted ?? candidates[0];
  if (story)
    return { kind: "story", storyId: story.id, title: story.title, drafted: Boolean(drafted) };
  return { kind: "build", storyType: theme.storyTypes[0] };
}

export type QuestionToBuild = {
  question: string;
  storyType: StoryTypeId;
  // The job it's likely for: its company, or its title without one.
  job: string;
};

type JobLike = {
  title: string;
  company: string | null;
  interviewDate: string | null;
  likelyQuestions: { questions: { question: string; theme: string }[] } | null;
};

// The likely questions no story answers yet, for starting a story from a real question. Jobs with
// the soonest interview come first, then each job's questions in their order. "Tell me about
// yourself" is left out: it has its own place in the picker.
export function questionsToBuild(
  jobs: JobLike[],
  stories: StoryLike[],
  limit = 6,
): QuestionToBuild[] {
  const ordered = [...jobs].sort(
    (a, b) => (a.interviewDate ?? "9999").localeCompare(b.interviewDate ?? "9999"),
  );
  const seen = new Set<string>();
  const out: QuestionToBuild[] = [];
  for (const job of ordered) {
    for (const q of job.likelyQuestions?.questions ?? []) {
      const key = q.question.trim().toLowerCase();
      if (seen.has(key)) continue;
      const coverage = coverageFor(q.theme, stories);
      if (coverage?.kind !== "build" || coverage.storyType === "about_me") continue;
      seen.add(key);
      out.push({ question: q.question, storyType: coverage.storyType, job: job.company || job.title });
      if (out.length === limit) return out;
    }
  }
  return out;
}

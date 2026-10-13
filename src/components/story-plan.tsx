import Link from "next/link";
import { startStory } from "@/app/stories/new/actions";
import type { StoryPriority } from "@/lib/jobs/content";
import { builderStage } from "@/lib/stories/content";
import type { StoryRecord } from "@/lib/stories/data";
import { REQUIRED_STORY_TYPE_ID, getStoryType } from "@/lib/stories/story-types";

// The stories the user's target jobs need, most needed first, each with where the user is on it.
export function StoryPlan({
  order,
  stories,
  limit,
}: {
  order: StoryPriority[];
  stories: StoryRecord[];
  limit?: number;
}) {
  const aboutMeDrafted = stories.some(
    (s) =>
      s.storyType === REQUIRED_STORY_TYPE_ID &&
      builderStage(s.content, getStoryType(s.storyType)) === "drafted",
  );
  return (
    <ol className="space-y-2" data-testid="story-plan">
      {order.slice(0, limit).map((p, i) => {
        const type = getStoryType(p.storyType);
        if (!type) return null;
        // listStories is newest first; prefer a drafted one.
        const mine = stories.filter((s) => s.storyType === type.id);
        const story =
          mine.find((s) => builderStage(s.content, type) === "drafted") ?? mine[0] ?? undefined;
        const drafted = story && builderStage(story.content, type) === "drafted";
        const locked = !story && type.id !== REQUIRED_STORY_TYPE_ID && !aboutMeDrafted;
        return (
          <li
            key={type.id}
            className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-black/5"
          >
            <span className="min-w-0">
              <span className="block font-semibold text-slate-900">
                <span className="mr-2 text-teal-800">{i + 1}.</span>
                {type.label}
              </span>
              {p.why && <span className="block text-sm text-slate-600">{p.why}</span>}
            </span>
            {story ? (
              <Link
                href={`/stories/${story.id}`}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                  drafted ? "bg-teal-800 text-white" : "bg-teal-50 text-teal-900 ring-1 ring-teal-800/20"
                }`}
              >
                {drafted ? "Draft written" : "In progress"}
              </Link>
            ) : locked ? (
              <span className="shrink-0 text-xs text-slate-500">After &ldquo;Tell me about yourself&rdquo;</span>
            ) : (
              <form action={startStory} className="shrink-0">
                <button
                  type="submit"
                  name="storyType"
                  value={type.id}
                  className="rounded-full px-3 py-1 text-xs font-semibold text-teal-800 ring-1 ring-teal-800/30 hover:bg-teal-50"
                >
                  Start
                </button>
              </form>
            )}
          </li>
        );
      })}
    </ol>
  );
}

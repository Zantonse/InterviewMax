"use server";

import { unstable_rethrow } from "next/navigation";
import { ModelError } from "@/lib/ai";
import { askedLabel } from "@/lib/bank/content";
import { recentSharedQuestions } from "@/lib/bank/data";
import { listJobs, type TargetJob } from "@/lib/jobs/data";
import { candidatePool } from "@/lib/reuse/content";
import { findAlsoAnswers } from "@/lib/reuse/find";
import { getStory, updateStory } from "@/lib/stories/data";
import { getStoryType } from "@/lib/stories/story-types";
import { listTranscriptsForPrep } from "@/lib/transcripts/data";
import type { BuilderResult } from "./actions";

// "Also answers": the other interview questions the current draft can answer, checked against the
// user's likely questions, past interviews, the shared bank, tough questions and the library.
// Never touches the draft or its grade.
export async function findOtherQuestions(storyId: string): Promise<BuilderResult> {
  try {
    const story = await getStory(String(storyId));
    if (!story) return { ok: false, error: "We couldn't find that story." };
    if (!story.content.draft) {
      return { ok: false, error: "Write the story first, then I'll find the other questions it answers." };
    }
    // Background sources: a failure in any of them leaves that source out.
    const [jobs, transcripts] = await Promise.all([
      listJobs().catch(() => [] as TargetJob[]),
      listTranscriptsForPrep(),
    ]);
    const companies = [...new Set(jobs.flatMap((j) => (j.company?.trim() ? [j.company.trim()] : [])))];
    const bank = (await Promise.all(companies.map((c) => recentSharedQuestions(c)))).flat();
    const candidates = candidatePool({
      jobs,
      interviews: transcripts.map((t) => ({ id: t.id, title: t.title, asked: t.analysis?.asked ?? [] })),
      bank: bank.map((q) => ({ question: q.question, theme: q.theme, label: askedLabel(q) })),
      asked: story.content.asked,
    });
    const alsoAnswers = await findAlsoAnswers({
      title: story.title,
      content: story.content,
      storyType: getStoryType(story.storyType),
      candidates,
    });
    const content = { ...story.content, alsoAnswers };
    await updateStory(story.id, { content });
    return { ok: true, content, title: story.title };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Also answers failed", err);
    if (err instanceof ModelError) {
      return { ok: false, error: "The writing assistant didn't respond. Try again in a moment." };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong. Try again." };
  }
}

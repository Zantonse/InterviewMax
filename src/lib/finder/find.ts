import "server-only";
import { generateForStep } from "@/lib/ai";
import { getJobsPrep } from "@/lib/jobs/data";
import { roleAnswerText } from "@/lib/roles/role-map";
import { themeCoverage } from "@/lib/stories/bank";
import type { StoryRecord } from "@/lib/stories/data";
import { REQUIRED_STORY_TYPE_ID } from "@/lib/stories/story-types";
import { finderBasis, quickAnswerText, type FinderSource, type StoryFinder } from "./content";
import { saveStoryFinder } from "./data";
import { FINDER_SYSTEM, finderMessages, parseFinderReply } from "./prompts";

// What the finder reads: the resume, and from "Tell me about yourself" the LinkedIn profile and
// role map answers. The three quick answers count only when there's nothing else to read.
export async function finderSources(
  stories: StoryRecord[],
  finder: StoryFinder | null,
): Promise<FinderSource[]> {
  const { resume } = await getJobsPrep();
  const aboutMe = stories.filter((s) => s.storyType === REQUIRED_STORY_TYPE_ID);
  const linkedin = aboutMe.find((s) => s.content.linkedin)?.content.linkedin?.text ?? "";
  const roleMap = roleAnswerText(aboutMe.find((s) => s.content.roleMap)?.content.roleMap);
  const sources: FinderSource[] = [
    { id: "resume" as const, text: resume?.text ?? "" },
    { id: "linkedin" as const, text: linkedin },
    { id: "role_map" as const, text: roleMap },
  ].filter((s) => s.text.trim());
  const answers = quickAnswerText(finder?.answers);
  if (sources.length === 0 && answers) sources.push({ id: "answers", text: answers });
  return sources;
}

// Reads the sources once and saves the moments that pass the checks in code. One retry if too few
// survive them, since a quote that doesn't match costs its whole suggestion.
export async function findMoments(
  stories: StoryRecord[],
  finder: StoryFinder | null,
  sources: FinderSource[],
): Promise<StoryFinder> {
  if (sources.length === 0) throw new Error("There's nothing to read yet.");
  const coverage = themeCoverage(stories);
  const messages = finderMessages({
    sources,
    emptyThemes: coverage.filter((c) => c.status === "empty").map((c) => c.id),
    builtTypes: [...new Set(stories.flatMap((s) => (s.storyType ? [s.storyType] : [])))],
  });

  let best: { moments: ReturnType<typeof parseFinderReply>; model: string } | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await generateForStep("storyFind", { system: FINDER_SYSTEM, messages });
    if (result.stopReason === "refusal") throw new Error("The model declined to suggest stories.");
    let moments: ReturnType<typeof parseFinderReply> = [];
    try {
      moments = parseFinderReply(result.text, sources);
    } catch (err) {
      if (attempt === 1 && !best) throw err;
    }
    if (!best || moments.length > best.moments.length) best = { moments, model: result.model };
    if (best.moments.length >= 4) break;
  }
  if (!best || best.moments.length === 0) {
    throw new Error("I couldn't find moments I could point to in what you've written. Try again.");
  }

  const saved: StoryFinder = {
    ...(finder?.answers ? { answers: finder.answers } : {}),
    moments: best.moments,
    basis: finderBasis(sources),
    model: best.model,
    foundAt: new Date().toISOString(),
  };
  await saveStoryFinder(saved);
  return saved;
}

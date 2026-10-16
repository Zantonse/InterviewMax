import { untracedNumbers } from "@/lib/stories/numbers";
import {
  MAX_SUMMARY_LENGTH,
  bulletProblems,
  checkedRole,
  cleanBullet,
  newBulletId,
  orderForJob,
  summaryProblems,
  type FinishedStory,
  type ResumeBullet,
} from "./content";
import type { RawBullet } from "./prompts";

// Checks one reply from the writer: every bullet's figures against its own story's answers, its
// length and voice, and the summary's figures against the About me answers. Plain code.

export function replyProblems(
  reply: { summary: string; bullets: RawBullet[] },
  stories: FinishedStory[],
  summarySource: string,
): string[] {
  const problems = reply.bullets.flatMap((b) =>
    bulletProblems(cleanBullet(b.text), stories[b.story].source).map(
      (p) => `The bullet for s${b.story + 1} ("${cleanBullet(b.text)}") ${p}`,
    ),
  );
  const covered = new Set(reply.bullets.map((b) => b.story));
  const missing = stories.map((_, i) => i).filter((i) => !covered.has(i));
  if (missing.length) {
    problems.push(`Write at least one bullet for ${missing.map((i) => `s${i + 1}`).join(", ")}`);
  }
  return [...problems, ...summaryProblems(reply.summary, summarySource)];
}

// Turns a checked reply into bullets for the job: figures that can't be traced cost the bullet
// (never shown), role names are kept only as the user wrote them, strong fits come first.
export function bulletsFromReply(
  reply: { bullets: RawBullet[] },
  stories: FinishedStory[],
  resume: string,
): { bullets: ResumeBullet[]; leftOut: number } {
  let leftOut = 0;
  const bullets: ResumeBullet[] = [];
  for (const b of reply.bullets) {
    const story = stories[b.story];
    const text = cleanBullet(b.text);
    if (!text) continue;
    if (untracedNumbers(text, story.source).length > 0) {
      leftOut++;
      continue;
    }
    bullets.push({
      id: newBulletId(),
      storyId: story.id,
      storyTitle: story.title,
      role: checkedRole(b.title, b.company, `${story.source}\n${resume}`),
      text,
      fit: b.fit,
      why: b.fit === "none" ? "" : b.why.slice(0, 200),
      picked: b.fit !== "none",
      untracedNumbers: [],
    });
  }
  return { bullets: orderForJob(bullets), leftOut };
}

// The summary, or nothing when one of its figures can't be traced.
export function checkedSummary(summary: string, source: string): string {
  const text = summary.replace(/\s+/g, " ").trim().slice(0, MAX_SUMMARY_LENGTH);
  return text && untracedNumbers(text, source).length === 0 ? text : "";
}

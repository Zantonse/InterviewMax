import { countWords } from "@/lib/stories/grading";
import { untracedNumbers } from "@/lib/stories/numbers";
import { VERSIONS, parseDetail, versionChecks, type VividDetail } from "./content";
import type { TellReply } from "./prompts";

// The code checks on a "How to tell it" reply (see coach.ts). Plain code, no model call.

// What's wrong with a reply, in words the model can act on. Empty when it's good.
export function tellingProblems(reply: TellReply, answers: string): string[] {
  const problems: string[] = [];
  const untraced = untracedNumbers(replyText(reply), answers);
  if (untraced.length) {
    problems.push(
      `These figures aren't in the user's answers: ${untraced.join(", ")}. Use only figures they gave, exactly as written, or leave them out.`,
    );
  }
  if (reply.hooks.length < 2) problems.push("Write two hook options.");
  for (const v of VERSIONS) {
    const beats = reply.versions[v.id];
    const words = countWords(beats.map((b) => b.text).join(" "));
    if (words > v.words.max) {
      problems.push(`The "${v.id}" version is ${words} words; keep it under ${v.words.max}.`);
    }
    if (!beats.some((b) => b.beat === "turn")) {
      problems.push(`The "${v.id}" version has no turn beat.`);
    }
    for (const check of versionChecks(reply.hooks[0] ?? "", beats)) {
      if (!check.passed) problems.push(`The "${v.id}" version: ${check.note}`);
    }
  }
  const detail = parseDetail(reply.detail);
  if ("quote" in detail && !quoted(detail.quote, answers)) {
    problems.push(
      "The vivid detail must be copied word for word from the user's answers. If there isn't one, ask for one instead.",
    );
  }
  return problems;
}

// A detail that isn't really in their answers is replaced by a question asking for one.
export function checkedDetail(raw: unknown, answers: string): VividDetail {
  const detail = parseDetail(raw);
  if ("quote" in detail && !quoted(detail.quote, answers)) return parseDetail(undefined);
  return detail;
}

function quoted(quote: string, source: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[“”"‘’'.,;:!?…]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const q = norm(quote);
  return q.length >= 8 && norm(source).includes(q);
}

// The reply's text for the number check. Signposts ("Three things I did") count the steps that
// follow, not a fact, so they're left out.
export function replyText(reply: TellReply): string {
  return [
    ...reply.hooks,
    ...reply.versions.short.map((b) => b.text),
    ...reply.versions.long.map((b) => b.text),
  ]
    .join("\n")
    .replace(SIGNPOST_RE, "");
}

const SIGNPOST_RE =
  /\b(?:two|three|four|five|2|3|4|5)\s+(?:things|steps|moves|calls|changes|parts|reasons|decisions)\b/gi;

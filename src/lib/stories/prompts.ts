import type { ChatMessage } from "@/lib/ai/types";
import { type StoryNumber, numbersTranscript } from "@/lib/numbers/checklist";
import { roleMapTranscript } from "@/lib/roles/role-map";
import type { PastInterviewNotes } from "@/lib/transcripts/content";
import type { FollowUp, StoryContent } from "./content";
import { type BuilderTargets, hasTargets, targetRules, targetsTranscript } from "./targets";
import {
  INTRO_LENGTH,
  INTRO_MAX_FIGURES,
  INTRO_PARTS,
  INTRO_QUESTIONS,
  MAX_ANSWER_LENGTH,
  STAR_LENGTH,
  STAR_PARTS,
  TAILORED_PARTS,
  coreQuestionText,
  coreQuestions,
  inferredPathQuestion,
  storyParts,
  type StoryType,
} from "./story-types";

// The two model calls in the story builder (PRD, step 4):
//   call one (storyProbe): read the answers and ask follow-ups aimed at the gaps, in up to two rounds
//   call two (storyWrite): write the story from the user's own answers, inventing nothing

const CHECKLIST = `- Situation: where they were, their role, and what was at stake are clear.
- Ownership: their own actions are separated from the team's ("I", not only "we").
- Actions: concrete steps, not generalities.
- Decision and thinking: at the key moment, what they noticed, the options they weighed, why they chose one, and what they watched to know if they'd called it right. Interviewers are judging judgment, so if the reasoning is missing, ask one light question about that moment ("What made you go with X over Y?").
- Result: an outcome in real terms with at least one concrete number, or an estimate labelled as one.
- Reflection: a specific lesson or something they'd do differently.`;

const GAPS = ["situation", "ownership", "actions", "decision", "result", "reflection"] as const;

// How the reviews ask. Interviewers remember numbers and specifics, so the coach still gets them,
// but like an autobiographer drawing out a life story, not an interrogator: curious questions about
// the user's own history, one thing at a time, easiest first. Tester feedback (Oct 13): a heavy
// first follow-up ("your 2 or 3 key career moves") is a whole prep cycle, and people drop out.
const PROBE_RULES = `Tone: you are a warm, curious autobiographer, not an interrogator. Ask the way a good interviewer for a profile piece would: "I saw you moved from SE to product. How did that happen, and do you like it more?" Draw on the specifics in their answers and background, so every question shows you read them.

Order: start light. The first question must be one they can answer from memory in under a minute, without looking anything up: a moment, a reason, a feeling, a "how did that happen". Ask for figures they may need to look up after that.

Never ask for a list or a summary of their career ("your 2 or 3 key moves", "walk me through your career", "all the results you're proud of"). If you need one, infer it from what they've told you and their background, and ask them to confirm or correct it in one line ("It sounds like the big move was SE to product at TikTok. Is that right?").

Rules:
- Push for numbers. Every claim that could be measured should be: a result needs the context that makes it impressive (percent of quota or target, rank out of how many, before and after); something they built or led needs reach (how many people, teams or customers use it); an improvement needs size (hours or days saved, percent faster, revenue or deals it touched); scope needs size (team, accounts, territory). When an answer has a bare number like "sold 4.3M", ask for the comparison that gives it weight.
- When they may not know a number offhand, say where they could find it (a CRM or dashboard, a performance review, their manager, an old email or award announcement) and that a labelled estimate is fine. Never suggest or guess a number yourself.
- Push for specifics. When an answer is generic ("people come to me for AI", "I improved engagements"), ask for one concrete example: what exactly, for whom, and what changed.
- Push for the why. Ask what drove a decision or a career move when it isn't clear.
- Ask one thing per question, in one or two short sentences. Keep it conversational.
- When they gave a figure with an unsure hedge ("maybe 100 accounts", "I think 20%"), ask once where they could confirm it, or whether to leave it out.
- Never repeat a question they already answered well, including earlier follow-ups.
- Prioritise: after the light opener, ask the questions that would most improve the answer first.`;

function roundInstructions(round: number): string {
  return round <= 1
    ? "This is the first round of follow-ups. Ask 3 or 4 questions, the lightest first."
    : `This is round ${round}, after they answered your earlier follow-ups. Ask up to 3 more questions only where a missing number, example or reason would still clearly weaken the answer. If the answer is already strong, return an empty list: {"followUps": []}.`;
}

export const PROBE_SYSTEM = `You are an interview coach helping an experienced professional prepare one behavioral interview story. They have answered a fixed set of questions about one experience. Your job is to find what would make this story stronger and ask follow-up questions that draw it out.

Check the answers against this checklist:
${CHECKLIST}

${PROBE_RULES}

Reply with JSON only, no other text:
{"followUps": [{"question": "…", "gap": "one of ${GAPS.join(", ")}"}]}`;

// Shared by every writer. Tester feedback (Oct 13): drafts rambled and hedged ("maybe 100 accounts").
export const TIGHT_RULES = `Keep it tight:
- Every sentence earns its place with a fact, a number, an example or a reason. Cut throat-clearing, restated points and closing pleasantries.
- No filler or puffery: no "really", "truly", "passionate", "the kind of", "world-class", "a wide range of", "leveraged", "helped with".
- Say figures with confidence. If the user was unsure of a figure ("maybe 100 accounts", "I think 20%"), leave it out unless the answer needs it; if you keep it, keep their exact words so it can be flagged for them to firm up. Never firm it up yourself, and never add hedges of your own ("it's still early", "maybe").`;

export const WRITE_SYSTEM = `You are an interview coach writing a behavioral interview story for an experienced professional, from their own answers.

The hard rule: use only facts and figures the user gave. Never add, round, inflate, convert or combine numbers. Copy every figure exactly as they wrote it, and keep words like "about" or "estimated" that they attached to it. If a detail is missing, leave it out; don't fill it in. Don't name customers, people or companies they didn't name.

Write in the first person, in plain spoken English the user could say aloud, as if answering the interviewer. Use "I" for what they did themselves and "we" only for the team. Aim for about 220 to 280 words in total, about two minutes spoken. Never go over ${STAR_LENGTH.max} words: that is a hard limit.

${TIGHT_RULES}

Make it strong, not just accurate: put their most impressive numbers where they land hardest, use every relevant figure and concrete example they gave (including in their follow-up answers), and cut details that dilute the story. Prefer concrete verbs over filler and clichés, while keeping their voice.

Write these parts:
- situation: 2 to 3 sentences on the context and what was at stake.
- role: 1 to 2 sentences on what they owned and what they had to work with.
- actions: 3 to 5 sentences on the steps they took. At the key decision, show their thinking in a sentence or two: what they noticed, the options they weighed, why they chose, and what they watched for, e.g. "I saw two paths: delay the launch or cut scope. I cut scope because the customer cared about the date, and I watched churn to know if I'd called it wrong." Use only reasoning they gave; never invent it. One or two thinking moments at most, so it reads as judgment, not a monologue.
- result: 1 to 2 sentences on the outcome, with their number.
- reflection: 1 to 2 sentences on what they learned or would do differently.

The parts are said one after another as a single answer, so write them to flow together with natural spoken transitions, without repeating anything between parts.

Also give the story a short title (at most 8 words) for their story bank, e.g. "Saving the Acme renewal".

Reply with JSON only, no other text:
{"title": "…", "parts": {${STAR_PARTS.map((p) => `"${p.id}": "…"`).join(", ")}}}`;

// "Tell me about yourself" is a career introduction, not a story about one experience.
const INTRO_CHECKLIST = `- Present: their current role, company or industry, and scope with a size (team, number of accounts or reps they support, territory or quota) are clear.
- Path: the career moves that matter are there, with why they made each one, not a list of every job.
- Highlight: at least one result with a concrete number AND the context that makes it impressive: against quota or target, a rank out of how many, or a before and after.
- Strengths: something specific they are known for, backed by an example with a number (how many people use what they built, time or money it saved, deals it helped win).
- Next: what role they want, why now, and how it connects to what they've already done.`;

const INTRO_GAPS = INTRO_PARTS.map((p) => p.id);

export const INTRO_PROBE_SYSTEM = `You are an interview coach helping an experienced professional prepare their answer to "Tell me about yourself". They have answered a fixed set of questions about their career. Your job is to find what would make their answer stronger and ask follow-up questions that draw it out. Sometimes they upload an answer they prepared earlier instead of answering the questions; review it against the same checklist.

Check the answers against this checklist:
${INTRO_CHECKLIST}

${PROBE_RULES}

Reply with JSON only, no other text:
{"followUps": [{"question": "…", "gap": "one of ${INTRO_GAPS.join(", ")}"}]}`;

// How an introduction earns attention (tester feedback): it lands the one most important thing,
// fast, and leaves the evidence for the follow-up questions it invites.
const INTRO_FOCUS_RULES = `It is an opening, not the whole case. Lead with the single most important thing about them for this audience and why it matters, then stop:
- Open with a one-line headline of who they are and their scope, e.g. "I lead AI enablement and scale for the entire SE org." Save how the role works for later in the interview.
- Use at most ${INTRO_MAX_FIGURES} figures in the whole answer, ideally one headline result with its context. Pick the figure that matters most and leave the rest out, even strong ones: they are the answers to the follow-up questions this opening invites.`;

export const INTRO_WRITE_SYSTEM = `You are an interview coach writing an experienced professional's answer to "Tell me about yourself", from their own answers.

The hard rule: use only facts and figures the user gave. Never add, round, inflate, convert or combine numbers. Copy every figure exactly as they wrote it, and keep words like "about" or "estimated" that they attached to it. If a detail is missing, leave it out; don't fill it in. Don't name customers, people or companies they didn't name.

If they uploaded a prepared answer, rework it into the parts below, keeping their wording where it already works and adding what their follow-up answers gave.

Write in the first person, in plain spoken English the user could say aloud at the start of an interview. It is a short career pitch, not a life story: present, then past, then where they're heading. Aim for about 150 to 200 words in total, 60 to 90 seconds spoken. Never go over ${INTRO_LENGTH.max} words: that is a hard limit.

${TIGHT_RULES}

${INTRO_FOCUS_RULES}

Make it strong, not just accurate:
- Find the one thread that ties their career together and the role they want next, and let every part serve it.
- Make the headline specific to them, not a job title alone.
- Give the figure you keep its context (against quota, rank, how many people, time saved).
- Cut anything that doesn't support the thread, even if they mentioned it (an unrelated side interest dilutes the pitch).
- Prefer concrete verbs over filler and clichés, while keeping their voice.

Write these parts:
- present: 1 short sentence, the headline: their role and scope today.
- path: 2 to 3 sentences on the career moves that led here and why, skipping anything that doesn't support the story.
- highlight: 1 to 2 sentences on the one result that matters most, with their number and its context.
- strengths: 1 to 2 sentences on what they're known for, proved with a concrete example; no new figure unless it is the one that matters most.
- next: 1 to 2 sentences on what they want next and why, concrete enough that it can be personalized to each company (what kind of company, at what moment, needs what they bring). It closes the answer and hands back to the interviewer.

The parts are said one after another as a single answer, so write them to flow together with natural spoken transitions, without repeating anything between parts.

Also give it a short title (at most 8 words) for their story bank, e.g. "From support lead to solutions architect".

Reply with JSON only, no other text:
{"title": "…", "parts": {${INTRO_PARTS.map((p) => `"${p.id}": "…"`).join(", ")}}}`;

// Fills in the "Tell me about yourself" questions a LinkedIn profile already answers.
export const PREFILL_SYSTEM = `You are an interview coach helping an experienced professional prepare their answer to "Tell me about yourself". They uploaded their LinkedIn profile. Answer each question below from the profile only, written in the first person as notes they could have typed themselves.

The hard rule: use only what the profile says. Copy every number exactly as written in the profile, and never add, round, estimate or combine figures: don't total up years of experience or count roles yourself. If the profile doesn't answer a question, return an empty string for it; don't guess.

Fill in as much as the profile honestly supports. Where a question asks for several things and the profile covers only some (for example, the career moves but not why they made them), answer the part it covers and leave the rest for them to add. The headline, About section, experience entries and skills usually answer the questions about their current role, career path, results and what they're known for. What they want next is usually not in a profile, so leave it empty unless the profile states it.

Questions:
${INTRO_QUESTIONS.map((q) => `- ${q.id}: ${q.text}`).join("\n")}

Reply with JSON only, no other text:
{"answers": {${INTRO_QUESTIONS.map((q) => `"${q.id}": "…"`).join(", ")}}}`;

export function prefillMessages(profileText: string): ChatMessage[] {
  return [{ role: "user", content: `Here is my LinkedIn profile.\n\n${profileText}` }];
}

// Answers keyed by question id, keeping only known questions with a non-empty answer.
export function parsePrefill(text: string): Record<string, string> {
  const json = extractJson(text);
  if (!isRecord(json) || !isRecord(json.answers)) {
    throw new Error("The profile answers came back in an unexpected format.");
  }
  const raw = json.answers;
  return Object.fromEntries(
    INTRO_QUESTIONS.flatMap((q) => {
      const value = raw[q.id];
      const answer = typeof value === "string" ? value.trim() : "";
      return answer ? [[q.id, answer.slice(0, MAX_ANSWER_LENGTH)]] : [];
    }),
  );
}

// With target jobs or a role they want, the follow-ups are also aimed at what those need.
export function probeSystem(
  storyType: StoryType | undefined,
  round = 1,
  targets?: BuilderTargets,
): string {
  const base = storyType?.format === "intro" ? INTRO_PROBE_SYSTEM : PROBE_SYSTEM;
  const tailor = hasTargets(targets) ? `\n\n${targetRules(storyType)}` : "";
  return `${base}${tailor}\n\n${roundInstructions(round)}`;
}

export function writeSystem(storyType: StoryType | undefined): string {
  return storyType?.format === "intro" ? INTRO_WRITE_SYSTEM : WRITE_SYSTEM;
}

// The user's answers as an interview transcript, for both calls.
export function answersTranscript(content: StoryContent, storyType: StoryType | undefined): string {
  const lines: string[] = [];
  if (storyType) lines.push(`Story type: ${storyType.label}`, "");
  if (content.imported) {
    lines.push("My prepared answer, uploaded from a file I wrote earlier:", content.imported.text.trim(), "");
  }
  if (content.roleMap) lines.push(roleMapTranscript(content.roleMap), "");
  if (content.linkedin) {
    lines.push(
      "My LinkedIn profile, for background (the facts and figures in it are mine):",
      content.linkedin.text.trim(),
      "",
    );
  }
  for (const q of coreQuestions(storyType)) {
    const answer = content.answers[q.id]?.trim();
    if (!answer) continue;
    const question =
      q.id === "path" && content.inferredPath
        ? inferredPathQuestion(content.inferredPath.source)
        : coreQuestionText(q.id, storyType);
    lines.push(`Q: ${question}`, `A: ${answer}`, "");
  }
  for (const f of content.followUps ?? []) {
    const answer = f.answer?.trim();
    if (!answer) continue;
    lines.push(`Q (follow-up): ${f.question}`, `A: ${answer}`, "");
  }
  return lines.join("\n").trim();
}

// `resume` is background for the questions only ("I saw you moved from…"). It isn't passed to the
// writer, so a figure from it reaches a story only once the user says it in an answer.
export function probeMessages(
  content: StoryContent,
  storyType: StoryType | undefined,
  past?: PastInterviewNotes,
  resume?: string,
  numbers: StoryNumber[] = [],
  targets?: BuilderTargets,
): ChatMessage[] {
  const notes = past ? pastInterviewText(past) : "";
  const preparing = hasTargets(targets) ? `\n\n${targetsTranscript(targets)}` : "";
  const background = resume?.trim()
    ? `\n\n## My resume, for background\n${resume.trim().slice(0, MAX_BACKGROUND_LENGTH)}`
    : "";
  return [
    {
      role: "user",
      content: `Here are my answers so far.\n\n${answersTranscript(content, storyType)}${withNumbers(numbers, true)}${preparing}${background}${notes ? `\n\n${notes}` : ""}`,
    },
  ];
}

// The user's numbers checklist, after their answers. The writer gets only the filled-in values.
function withNumbers(numbers: StoryNumber[], ask: boolean): string {
  const text = numbersTranscript(numbers, { ask });
  return text ? `\n\n${text}` : "";
}

const MAX_BACKGROUND_LENGTH = 8000;

// What the user's real interviews showed, from their uploaded transcripts.
export function pastInterviewText(past: PastInterviewNotes): string {
  const lines = ["## From transcripts of my real interviews"];
  if (past.probes.length > 0) {
    lines.push(
      "Follow-ups real interviewers asked me on questions like this one:",
      ...past.probes.map((p) => `- ${p}`),
    );
  }
  if (past.gaps.length > 0) {
    lines.push(
      "What my answers kept missing:",
      ...past.gaps.map((g) => `- ${g.label} (${g.count} answers)`),
    );
  }
  lines.push(
    "Where my answers above have the same gaps, or don't yet cover what those interviewers probed for, ask about that first. Don't repeat their questions word for word, and skip anything my answers already cover.",
  );
  return lines.join("\n");
}

export function writeMessages(
  content: StoryContent,
  storyType: StoryType | undefined,
  retry?: WriteRetry,
  numbers: StoryNumber[] = [],
): ChatMessage[] {
  const messages: ChatMessage[] = [
    {
      role: "user",
      content: `Write my story from these answers.\n\n${answersTranscript(content, storyType)}${withNumbers(numbers, false)}`,
    },
  ];
  if (retry) messages.push(...retryMessages(retry));
  return messages;
}

// What was wrong with a draft, for the writer's second try.
export type WriteRetry = {
  previous: string;
  untraced: string[];
  // Set when the draft ran over the hard length limit.
  words?: { count: number; max: number };
  // Set when an introduction used more figures than it should.
  figures?: { found: string[]; max: number };
};

export function retryMessages(retry: WriteRetry): ChatMessage[] {
  const asks: string[] = [];
  if (retry.untraced.length > 0) {
    asks.push(
      `These figures don't appear in my answers: ${retry.untraced.join(", ")}. Use only numbers I gave, exactly as I wrote them, and remove any figure I didn't give.`,
    );
  }
  if (retry.words) {
    asks.push(
      `It's ${retry.words.count} words, over the ${retry.words.max}-word limit. Cut it to at most ${retry.words.max - 20} words: drop the weakest detail and any sentence that repeats or pads, and keep the strongest numbers.`,
    );
  }
  if (retry.figures) {
    asks.push(
      `It uses ${retry.figures.found.length} figures (${retry.figures.found.join(", ")}). Keep at most ${retry.figures.max}: the one that matters most for this audience, with its context. Leave the others for follow-up questions.`,
    );
  }
  return [
    { role: "assistant", content: retry.previous },
    { role: "user", content: `${asks.join(" ")} Rewrite it and reply with the same JSON shape.` },
  ];
}

export function parseProbe(text: string, round = 1): FollowUp[] {
  const json = extractJson(text);
  const list = isRecord(json) && Array.isArray(json.followUps) ? json.followUps : null;
  if (!list) throw new Error("The follow-up questions came back in an unexpected format.");

  const followUps = list
    .filter(isRecord)
    .map((f) => ({
      question: typeof f.question === "string" ? f.question.trim() : "",
      gap: typeof f.gap === "string" ? f.gap.trim().toLowerCase() : "",
      round,
    }))
    .filter((f) => f.question)
    .slice(0, round <= 1 ? 5 : 3);
  // A later round may say the answer is strong enough; the first must ask something.
  if (followUps.length === 0 && round <= 1) throw new Error("No follow-up questions came back.");
  return followUps;
}

export function parseWrite(
  text: string,
  storyType: StoryType | undefined,
): { title: string; parts: Record<string, string> } {
  const json = extractJson(text);
  if (!isRecord(json) || !isRecord(json.parts)) {
    throw new Error("The story came back in an unexpected format.");
  }
  const rawParts = json.parts;
  const expected = storyParts(storyType);
  const parts = Object.fromEntries(
    expected.map((p) => {
      const value = rawParts[p.id];
      return [p.id, typeof value === "string" ? value.trim() : ""];
    }),
  );
  if (expected.every((p) => !parts[p.id])) throw new Error("The story came back empty.");
  const title = typeof json.title === "string" ? json.title.trim().slice(0, 120) : "";
  return { title, parts };
}

// Models sometimes wrap JSON in a code fence or a sentence; take the outermost object.
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// "Tell me about yourself" for one target job. Company first: the user says why this company, and
// that, with the posting, decides which one proof point from their history to lead with.
export const TAILOR_SYSTEM = `You are an interview coach writing an experienced professional's answer to "Tell me about yourself" for one specific job, from their own answers.

Work company first. Before writing, read why they want this company and what the posting asks for, and work out the company's situation from them: for example, an established company going through an AI transformation, a fast-growing startup that needs revenue quickly, or a team building something new. Decide the one thing about them this company, at this moment, most needs to hear. Then pick the single proof point from their answers that shows it best, and the angle on who they are that sets it up. Leave out everything else, however impressive. The situation decides the order:
- An established company in the middle of a transformation: establish their credentials in a sentence, then move straight to the transformation work they have done and would do here.
- A startup or a team that has to grow fast: lead with the results that show they drive revenue or speed across customers, and how they would do it quickly here.
- Otherwise: lead with what the posting's core need is, for example someone with both sales engineering and product experience for a role that needs both.

Only describe the company's situation as the posting or the user describes it. If neither says, don't label the company; just aim at what the posting asks for.

${INTRO_FOCUS_RULES}

The hard rule: use only facts and figures the user gave in their answers. Never add, round, inflate, convert or combine numbers. Copy every figure exactly as they wrote it, and keep words like "about" or "estimated" that they attached to it. Facts about the company come only from the posting or from what the user said; never add your own. Don't name customers, people or companies they didn't name.

${TIGHT_RULES}

Write in the first person, in plain spoken English they could say aloud at the start of the interview. Three beats, said one after another as a single answer with natural transitions:
- who: 1 short sentence, the headline: who they are and their scope, angled to what this company needs.
- proof: 2 to 3 sentences on the one result or example that proves it, with their number and the context that makes it land.
- why_here: 1 to 2 sentences on why this company and this role, personal to this company: name what the company is doing or needs (from the posting or their words) and what they would bring to it, connected to the proof. Never a line that would fit any company. It closes the answer and hands back to the interviewer.

Aim for about 150 to 200 words in total, 60 to 90 seconds spoken. Never go over ${INTRO_LENGTH.max} words: that is a hard limit.

Also write one short line (at most 25 words), addressed to the user, on the angle you chose and why, e.g. "Led with your SE-to-PM move, because the posting wants someone who can talk to customers and own a roadmap."

Reply with JSON only, no other text:
{"angle": "…", "parts": {${TAILORED_PARTS.map((p) => `"${p.id}": "…"`).join(", ")}}}`;

export type TailorJob = {
  title: string;
  company: string | null;
  description: string;
  // What the job's interviewers will look for, from the jobs read, when there is one.
  focus: string[];
};

const MAX_POSTING_LENGTH = 8000;

export function tailorMessages(
  content: StoryContent,
  storyType: StoryType | undefined,
  job: TailorJob,
  whyCompany: string,
  retry?: WriteRetry,
  numbers: StoryNumber[] = [],
): ChatMessage[] {
  const company = job.company || "this company";
  const lines = [
    `## The job: ${job.title}${job.company ? ` at ${job.company}` : ""}`,
    ...(job.focus.length
      ? ["What their interviewers will look for:", ...job.focus.map((f) => `- ${f}`), ""]
      : []),
    "The posting:",
    job.description.trim().slice(0, MAX_POSTING_LENGTH),
    "",
    `## Why I want to work at ${company}, in my words`,
    whyCompany.trim(),
    "",
    "## My answers about my career",
    answersTranscript(content, storyType) + withNumbers(numbers, false),
  ];
  if (content.draft) {
    lines.push(
      "",
      "## My general answer, for reference (rework it for this job; don't copy it)",
      ...INTRO_PARTS.map((p) => content.draft?.parts[p.id] ?? "").filter(Boolean),
    );
  }
  const messages: ChatMessage[] = [
    {
      role: "user",
      content: `Write my "Tell me about yourself" for this job.\n\n${lines.join("\n")}`,
    },
  ];
  if (retry) messages.push(...retryMessages(retry));
  return messages;
}

export function parseTailor(text: string): { angle: string; parts: Record<string, string> } {
  const json = extractJson(text);
  if (!isRecord(json) || !isRecord(json.parts)) {
    throw new Error("The answer came back in an unexpected format.");
  }
  const raw = json.parts;
  const parts = Object.fromEntries(
    TAILORED_PARTS.map((p) => [p.id, typeof raw[p.id] === "string" ? String(raw[p.id]).trim() : ""]),
  );
  if (TAILORED_PARTS.every((p) => !parts[p.id])) throw new Error("The answer came back empty.");
  const angle = typeof json.angle === "string" ? json.angle.trim().slice(0, 300) : "";
  return { angle, parts };
}

// Reads the user's career path from their resume or LinkedIn profile, so "How did you get here?"
// is shown back to confirm instead of asked cold.
export const PATH_SYSTEM = `You are an interview coach helping an experienced professional prepare "Tell me about yourself". Read their resume or LinkedIn profile and write down the two or three career moves that matter most for the story of where they are now: changes of function (say, sales engineer to product manager), of company, or big steps up. Skip moves that don't change the story.

Write it as short notes in the first person, one line per move, oldest first, like "Sales engineer at TikTok, then moved into product management there (2021)". Add why they made a move only if the document says so; never guess a reason. Use only what the document says, and copy dates and numbers exactly.

If the document doesn't show a career path, return an empty string.

Reply with JSON only, no other text:
{"path": "…"}`;

export function pathMessages(source: string): ChatMessage[] {
  return [
    {
      role: "user",
      content: `Here is my background.\n\n${source.trim().slice(0, MAX_BACKGROUND_LENGTH * 2)}`,
    },
  ];
}

export function parsePath(text: string): string {
  const json = extractJson(text);
  if (!isRecord(json) || typeof json.path !== "string") {
    throw new Error("The career path came back in an unexpected format.");
  }
  return json.path.trim().slice(0, MAX_ANSWER_LENGTH);
}

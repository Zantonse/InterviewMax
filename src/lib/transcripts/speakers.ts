import type { ChatMessage } from "@/lib/ai/types";
import { isRecord } from "@/lib/jobs/content";
import { extractJson } from "@/lib/stories/prompts";

// Who said what, for transcripts that don't say (tester feedback, Oct 16: recorded interviews
// often come with no speaker names, which makes them hard to review). One model call
// ("transcriptSpeakers") splits the transcript into turns. It never rewrites the text: for each
// turn it copies the first few words, and code cuts the transcript at those words, in order. Words
// it can't find are ignored, so the text that's saved is always the user's own, with a label in
// front of each turn. The user can flip any turn before the review runs again.

export type SpeakerRole = "interviewer" | "me";
export type SpeakerTurn = { speaker: SpeakerRole; text: string };

// The labels written into a transcript labelled this way. "Me" is saved as the user's speaker, so
// the review knows which side is theirs.
export const SPEAKER_LABELS: Record<SpeakerRole, string> = { interviewer: "Interviewer", me: "Me" };
export const AUTO_SPEAKER = SPEAKER_LABELS.me;

// "Jane Doe:", "Speaker 1:", "Interviewer -", "[00:01:02] Sam:". A line has to start with one.
const LABEL_RE =
  /^\s*(?:\[?\(?\d{1,2}:\d{2}(?::\d{2})?\)?\]?\s*)?([A-Z][\w.'’-]*(?:\s+[A-Z0-9][\w.'’-]*){0,3})\s*(?:\(\d{1,2}:\d{2}(?::\d{2})?\))?\s*[:\-–—]\s+\S/;

// True when the transcript already says who is speaking: several lines start with a name and at
// least two different names take turns.
export function hasSpeakerLabels(transcript: string): boolean {
  const names = new Map<string, number>();
  let labelled = 0;
  for (const line of transcript.split("\n")) {
    const m = LABEL_RE.exec(line);
    if (!m) continue;
    labelled += 1;
    const name = m[1].toLowerCase();
    names.set(name, (names.get(name) ?? 0) + 1);
  }
  const takingTurns = [...names.values()].filter((n) => n >= 2).length;
  return labelled >= 4 && takingTurns >= 2;
}

const START_WORDS = 8;

export const TRANSCRIPT_SPEAKERS_SYSTEM = `You are splitting the transcript of a job interview into turns, because it doesn't say who is speaking. There are two sides: the interviewer (one or more people asking the questions) and the candidate (the person being interviewed, who is the user).

Go through the whole transcript in order. Each time the speaker changes, start a new turn. For each turn give:
- speaker: "interviewer" or "me" (the candidate).
- start: the first ${START_WORDS} or so words of the turn, copied exactly from the transcript, character for character. Never paraphrase or fix typos: they are used to find the turn in the text.

How to tell them apart: the interviewer asks the questions, introduces the company and the role, and follows up ("Can you say more about…?"); the candidate answers with their own experience ("At my last company I…") and asks questions near the end. Small talk at the start counts too. Cover the whole transcript, from its very first words to the end, and don't skip short turns like "Great, thanks."

Reply with JSON only, no other text:
{"turns": [{"speaker": "interviewer|me", "start": "…"}]}`;

export function transcriptSpeakersMessages(input: {
  transcript: string;
  job?: { title: string; company: string | null } | null;
}): ChatMessage[] {
  const job = input.job
    ? `The interview was for: ${input.job.title}${input.job.company ? ` at ${input.job.company}` : ""}\n\n`
    : "";
  return [
    {
      role: "user",
      content: `Split this interview into turns.\n\n${job}## Transcript\n${input.transcript.trim()}`,
    },
  ];
}

// Cuts the transcript at each turn's first words, in order. Turns whose words aren't found after
// the previous turn are dropped (their text stays with the turn before). Text before the first
// turn found joins it. Neighbouring turns by the same side are merged.
export function parseSpeakerTurns(text: string, transcript: string): SpeakerTurn[] {
  const json = extractJson(text);
  const list = isRecord(json) && Array.isArray(json.turns) ? json.turns : null;
  if (!list) throw new Error("The speaker turns came back in an unexpected format.");

  const cuts: { at: number; speaker: SpeakerRole }[] = [];
  let from = 0;
  for (const raw of list) {
    if (!isRecord(raw) || typeof raw.start !== "string") continue;
    const speaker = raw.speaker === "me" ? "me" : raw.speaker === "interviewer" ? "interviewer" : null;
    if (!speaker) continue;
    const at = findFrom(transcript, raw.start, from);
    if (at < 0) continue;
    cuts.push({ at, speaker });
    from = at + 1;
  }
  if (cuts.length === 0) return [];
  cuts[0] = { ...cuts[0], at: 0 };

  const turns: SpeakerTurn[] = [];
  cuts.forEach((cut, i) => {
    const piece = transcript.slice(cut.at, cuts[i + 1]?.at ?? transcript.length).trim();
    if (!piece) return;
    const last = turns[turns.length - 1];
    if (last && last.speaker === cut.speaker) last.text = `${last.text}\n${piece}`;
    else turns.push({ speaker: cut.speaker, text: piece });
  });
  return turns;
}

// Where `words` start in the transcript at or after `from`, allowing for differences in spacing
// and line breaks; -1 if they aren't there.
function findFrom(transcript: string, words: string, from: number): number {
  const parts = words
    .trim()
    .replace(/^["“”']+|["“”']+$/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, START_WORDS);
  if (parts.length === 0) return -1;
  const re = new RegExp(parts.map(escapeRegExp).join(String.raw`\s+`), "g");
  re.lastIndex = from;
  return re.exec(transcript)?.index ?? -1;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The transcript as saved: each turn on its own paragraph, with its label in front.
export function labelledTranscript(turns: SpeakerTurn[]): string {
  return turns.map((t) => `${SPEAKER_LABELS[t.speaker]}: ${t.text.trim()}`).join("\n\n");
}

// Reads a transcript labelled this way back into turns, so the user can flip who said what.
// Empty when it wasn't labelled this way (some turn doesn't start with one of the two labels).
export function turnsFromLabelled(transcript: string): SpeakerTurn[] {
  const paragraphs = transcript.split(/\n{2,}/);
  const turns: SpeakerTurn[] = [];
  const label = new RegExp(`^(${SPEAKER_LABELS.interviewer}|${SPEAKER_LABELS.me}): `);
  for (const p of paragraphs) {
    const m = label.exec(p);
    if (!m) {
      // A blank line inside a turn: it belongs to the turn before.
      if (turns.length === 0) return [];
      turns[turns.length - 1].text += `\n\n${p}`;
      continue;
    }
    turns.push({
      speaker: m[1] === SPEAKER_LABELS.me ? "me" : "interviewer",
      text: p.slice(m[0].length),
    });
  }
  return turns.length >= 2 ? turns : [];
}

// The same turns with new speakers, as the user set them. Neighbours by the same side merge.
export function relabel(turns: SpeakerTurn[], speakers: SpeakerRole[]): SpeakerTurn[] {
  if (speakers.length !== turns.length) throw new Error("The turns changed. Reload and try again.");
  const out: SpeakerTurn[] = [];
  turns.forEach((t, i) => {
    const speaker = speakers[i];
    const last = out[out.length - 1];
    if (last && last.speaker === speaker) last.text = `${last.text}\n${t.text}`;
    else out.push({ speaker, text: t.text });
  });
  return out;
}

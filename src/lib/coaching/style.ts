import type { Step } from "@/lib/ai/config";

// Coaching style (PRD v0.3, P2): how the coach talks to the user, picked in Settings. It changes
// tone only, never scores, facts or which gaps get flagged. "Balanced" is the default and adds
// nothing to the prompts, so the coaching steps read exactly as they did before the setting.

export const COACHING_STYLES = ["balanced", "gentle", "direct", "tough_love"] as const;

export type CoachingStyle = (typeof COACHING_STYLES)[number];

export const STYLE_OPTIONS: Record<CoachingStyle, { label: string; description: string }> = {
  balanced: {
    label: "Balanced",
    description: "What works and what to fix, in plain words. The default.",
  },
  gentle: {
    label: "Gentle",
    description: "Starts with what’s working and frames each gap as the next step.",
  },
  direct: {
    label: "Direct",
    description: "Names the gap in as few words as possible, no cushioning.",
  },
  tough_love: {
    label: "Tough love",
    description:
      "Holds the bar of a demanding hiring manager and says what would cost you the offer.",
  },
};

// The model steps that coach the user: the story builder's follow-up questions, practice and case
// feedback, and the profile summary. Grading is left out on purpose: its scores must not move with
// tone, and the eval harness measures it as it is.
export const COACHING_TONE_STEPS: readonly Step[] = [
  "storyProbe",
  "practiceFeedback",
  "casePractice",
  "profileSummary",
];

const TONE_ONLY =
  "This changes tone only: ask the same questions, flag the same gaps and keep every fact, figure, rating and output format exactly as the instructions above say.";

const TONE_LINES: Record<Exclude<CoachingStyle, "balanced">, string> = {
  gentle:
    "Coaching style: gentle. Lead with what is already working, frame each gap as the next step, and keep a warm, encouraging voice.",
  direct:
    "Coaching style: direct. Say what is missing plainly and briefly, with no cushioning or filler praise.",
  tough_love:
    "Coaching style: tough love. Speak like a demanding hiring manager who wants them to win: say plainly what would cost them the offer and why, without reassurance. Stay respectful, never sarcastic.",
};

export function parseCoachingStyle(value: unknown): CoachingStyle {
  return typeof value === "string" && (COACHING_STYLES as readonly string[]).includes(value)
    ? (value as CoachingStyle)
    : "balanced";
}

// The line added to a coaching step's system prompt, or "" for the default.
export function toneLine(style: CoachingStyle): string {
  return style === "balanced" ? "" : `${TONE_LINES[style]} ${TONE_ONLY}`;
}

export function withCoachingTone(
  step: Step,
  system: string | undefined,
  style: CoachingStyle,
): string | undefined {
  const line = COACHING_TONE_STEPS.includes(step) ? toneLine(style) : "";
  if (!line) return system;
  return system ? `${system}\n\n${line}` : line;
}

// Field mistakes: the few mistakes interviewers in a field cut people for. When the user's field
// has a list, case practice and practice feedback are told about it and may name up to two the
// answer clearly made, each with one sentence on what showed it. Nothing here scores or grades.
//
// Data governance's six come from Craig's "Data Governance Job Market Analysis" doc (Nov 2026):
// the six failure modes its interview guides name, plus its precision rules (governance vs.
// management, policy vs. standard vs. procedure).
//
// Plain data, safe to import in client components.

import type { Step } from "@/lib/ai/config";
import { untracedNumbers } from "@/lib/stories/numbers";
import type { FieldId, UserField } from "./fields";

export type Pitfall = {
  id: string;
  // Shown to the user.
  label: string;
  // For the model: what the mistake looks like in an answer.
  check: string;
};

export type PitfallHit = { id: string; label: string; note: string };

export const MAX_PITFALL_HITS = 2;

export const FIELD_PITFALLS: Partial<Record<FieldId, readonly Pitfall[]>> = {
  data_governance: [
    {
      id: "textbook",
      label: "Textbook definition",
      check:
        "defines a term or framework the way a textbook or an AI helper would, with nothing about how it worked in practice: the friction, the steward workload, the tool trade-offs",
    },
    {
      id: "quality_only",
      label: "Governance is more than data quality",
      check:
        "treats governance as only data quality, leaving out decision rights, ownership, policy, stewardship and how it's measured",
    },
    {
      id: "management",
      label: "Governance vs. management",
      check:
        "mixes up data governance (who decides, the rules, accountability) with data management (building and running the systems and pipelines)",
    },
    {
      id: "policy_levels",
      label: "Policy, standard, procedure",
      check:
        "blurs a policy (what and why), a standard (the measurable rule, how) and a procedure (who does what, when), so the policy reads like steps or the standard can't be checked",
    },
    {
      id: "no_ai",
      label: "AI governance left out",
      check:
        "the question touches AI, models, agents or new regulation, and the answer says nothing about a model inventory, bias testing, where the training data came from, audit trails or human oversight",
    },
    {
      id: "unquantified",
      label: "No root cause or measured result",
      check:
        "a fix with no root cause and no measured outcome, like \"the data was messy, so I cleaned it\"",
    },
  ],
};

// The model steps that may name field mistakes.
export const PITFALL_STEPS: readonly Step[] = ["casePractice", "practiceFeedback"];

export function fieldPitfalls(fieldId: FieldId | null | undefined): readonly Pitfall[] {
  return (fieldId && FIELD_PITFALLS[fieldId]) || [];
}

// Added to a pitfall step's system prompt when the user's field has a list, or "".
export function pitfallPromptLine(step: Step, field: UserField | null): string {
  if (!PITFALL_STEPS.includes(step)) return "";
  const list = fieldPitfalls(field?.id);
  if (!list.length) return "";
  return [
    "Interviewers in this field often cut candidates for these mistakes (id: what it looks like):",
    ...list.map((p) => `- ${p.id}: ${p.check}`),
    `If the answer clearly makes one of them, add "pitfalls" to the same JSON object: [{"id": "…", "note": "one sentence naming what in their answer showed it and what to say instead"}], at most ${MAX_PITFALL_HITS}, most serious first. Only flag a mistake the question called for (a question about a conflict between two teams doesn't need AI governance). When none applies, "pitfalls" is []. Never invent their experience, and don't put numbers in a note unless they said them.`,
  ].join("\n");
}

const ALL_PITFALLS = new Map(
  Object.values(FIELD_PITFALLS).flatMap((list) => (list ?? []).map((p) => [p.id, p] as const)),
);

// The mistakes the model named, kept only when the id is known and, given the text the user saw
// and said, the note brings in no new figure.
export function parsePitfalls(value: unknown, source?: string): PitfallHit[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .flatMap((v) => {
      if (typeof v !== "object" || v === null) return [];
      const r = v as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id.trim() : "";
      const note = typeof r.note === "string" ? r.note.trim().slice(0, 400) : "";
      const def = ALL_PITFALLS.get(id);
      if (!def || !note || seen.has(id)) return [];
      if (source !== undefined && untracedNumbers(note, source).length > 0) return [];
      seen.add(id);
      return [{ id, label: def.label, note }];
    })
    .slice(0, MAX_PITFALL_HITS);
}

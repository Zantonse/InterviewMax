import type { TailoredDraft } from "./content";
import { checkScript, type CheckResult } from "./grading";
import { INTRO_LENGTH, INTRO_MAX_FIGURES, TAILORED_PARTS } from "./story-types";

// "Tell me about yourself" for one target job (see tailorIntro in builder.ts): its script and the
// same quick checks as any story. Plain code, so the job page can show them.

export function tailoredText(parts: Record<string, string>): string {
  return TAILORED_PARTS.map((p) => parts[p.id] ?? "")
    .filter(Boolean)
    .join("\n\n");
}

export function tailoredChecks(draft: TailoredDraft): CheckResult[] {
  return checkScript({
    text: tailoredText(draft.parts),
    numberText: draft.parts.proof ?? "",
    untraced: draft.untracedNumbers,
    range: INTRO_LENGTH,
    where: "your proof point",
    maxFigures: INTRO_MAX_FIGURES,
  });
}

export const MAX_WHY_COMPANY_LENGTH = 2000;

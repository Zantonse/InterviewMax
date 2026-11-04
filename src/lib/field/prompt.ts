import type { Step } from "@/lib/ai/config";
import { FIELD_STEPS, type UserField, fieldPromptLine } from "./fields";

export function isFieldStep(step: Step): boolean {
  return FIELD_STEPS.includes(step);
}

// Adds the field line to a field step's system prompt (before the coaching tone line).
export function withFieldLine(
  step: Step,
  system: string | undefined,
  field: UserField | null,
): string | undefined {
  const line = isFieldStep(step) ? fieldPromptLine(field) : "";
  if (!line) return system;
  return system ? `${system}\n\n${line}` : line;
}

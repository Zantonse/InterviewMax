"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { ModelError } from "@/lib/ai";
import {
  MAX_ROLE_NAME_LENGTH,
  MAX_VALUE_LENGTH,
  OTHER_ROLE,
  type NumbersChecklist,
  checklistItems,
} from "@/lib/numbers/checklist";
import { getNumbersChecklist, saveNumbersChecklist } from "@/lib/numbers/data";
import { draftNumbers } from "@/lib/numbers/draft";
import { getNumbersFamily } from "@/lib/numbers/families";

export type FormState = { error?: string; notice?: string } | null;

// Picks the checklist for the user's role: the hand-written one for their family, or one drafted
// for their role by the model. Values already filled in are kept for any number still on the list.
export async function chooseRole(_prev: FormState, formData: FormData): Promise<FormState> {
  const familyId = String(formData.get("familyId") ?? "");
  const roleName = String(formData.get("roleName") ?? "")
    .trim()
    .slice(0, MAX_ROLE_NAME_LENGTH);
  const family = getNumbersFamily(familyId);
  if (!family && familyId !== OTHER_ROLE) return { error: "Pick your role first." };
  if (!family && !roleName) return { error: "Type your role, e.g. Revenue operations." };

  try {
    const previous = await getNumbersChecklist();
    let next: NumbersChecklist;
    if (family) {
      next = { familyId: family.id, values: {}, updatedAt: new Date().toISOString() };
    } else {
      const drafted = await draftNumbers(roleName);
      next = {
        familyId: null,
        roleName: drafted.role || roleName,
        items: drafted.items,
        values: {},
        model: drafted.model,
        updatedAt: new Date().toISOString(),
      };
    }
    if (previous) {
      for (const item of checklistItems(next)) {
        const value = previous.values[item.id];
        if (value) next.values[item.id] = value;
      }
    }
    await saveNumbersChecklist(next);
  } catch (err) {
    unstable_rethrow(err);
    console.error("Numbers checklist: choosing a role failed", err);
    if (err instanceof ModelError) {
      return { error: "The assistant didn't respond. Try again in a moment." };
    }
    return { error: err instanceof Error ? err.message : "Something went wrong. Try again." };
  }
  refresh();
  return null;
}

// Saves every value in the form. An emptied field clears that number.
export async function saveNumbers(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const checklist = await getNumbersChecklist();
    if (!checklist) return { error: "Pick your role first." };
    const values: Record<string, string> = {};
    for (const item of checklistItems(checklist)) {
      const value = String(formData.get(`value:${item.id}`) ?? "").trim();
      if (value.length > MAX_VALUE_LENGTH) {
        return { error: `Keep "${item.label}" under ${MAX_VALUE_LENGTH} characters.` };
      }
      if (value) values[item.id] = value;
    }
    await saveNumbersChecklist({ ...checklist, values, updatedAt: new Date().toISOString() });
  } catch (err) {
    unstable_rethrow(err);
    console.error("Numbers checklist: saving failed", err);
    return { error: err instanceof Error ? err.message : "Your numbers couldn't be saved." };
  }
  refresh();
  return { notice: "Saved. Your stories will use these from now on." };
}

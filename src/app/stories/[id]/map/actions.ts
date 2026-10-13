"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { ModelError } from "@/lib/ai";
import { WORK_QUESTIONS, getRoleFamily } from "@/lib/roles/families";
import { buildFunctionMap, writeRoleProfile } from "@/lib/roles/mapper";
import {
  FUNCTION_MARKS,
  type FunctionMark,
  type RoleMap,
  hasEnoughAnswers,
  roleLabel,
  roleMapStage,
} from "@/lib/roles/role-map";
import { builderStage } from "@/lib/stories/content";
import { getStory, updateStory, type StoryRecord } from "@/lib/stories/data";
import { MAX_ANSWER_LENGTH, getStoryType } from "@/lib/stories/story-types";

export type RoleResult = { ok: true; roleMap: RoleMap } | { ok: false; error: string };

// Step one: the work questions. Picks the function map: the hand-written one for their family, or
// one built for their role by the model.
export async function saveRoleWork(
  storyId: string,
  familyId: string,
  rawAnswers: Record<string, string>,
): Promise<RoleResult> {
  const answers: Record<string, string> = {};
  for (const q of WORK_QUESTIONS) {
    const value = rawAnswers?.[q.id];
    const text = typeof value === "string" ? value.trim() : "";
    if (text.length > MAX_ANSWER_LENGTH) {
      return fail(
        `Keep each answer under ${MAX_ANSWER_LENGTH.toLocaleString("en-US")} characters.`,
      );
    }
    if (text) answers[q.id] = text;
  }
  if (!hasEnoughAnswers(answers)) {
    return fail("Add your job title and at least three more answers so there's enough to map.");
  }

  return withIntroStory(storyId, async (story) => {
    const previous = story.content.roleMap;
    const family = getRoleFamily(familyId);
    let map: RoleMap;
    if (family) {
      map = { familyId: family.id, functions: family.functions, answers, marks: {} };
    } else {
      const built = await buildFunctionMap(answers);
      map = {
        familyId: null,
        roleName: built.name,
        functions: built.functions,
        answers,
        marks: {},
      };
    }
    // Keep their marks for any part that's still on the map.
    if (previous && previous.familyId === map.familyId) {
      for (const f of map.functions) {
        if (previous.marks[f.id]) map.marks[f.id] = previous.marks[f.id];
      }
    }
    if (previous?.seeded) map.seeded = previous.seeded;
    return save(story, map);
  });
}

// Step two: which parts of the function were theirs.
export async function saveRoleMarks(
  storyId: string,
  marks: Record<string, string>,
): Promise<RoleResult> {
  return withIntroStory(storyId, async (story) => {
    const previous = story.content.roleMap;
    if (!previous || roleMapStage(previous) === "questions") {
      return fail("Answer the questions about your work first.");
    }
    const clean: Record<string, FunctionMark> = {};
    for (const f of previous.functions) {
      const mark = marks?.[f.id];
      if (!FUNCTION_MARKS.some((m) => m.id === mark)) return fail(`Mark "${f.label}" first.`);
      clean[f.id] = mark as FunctionMark;
    }
    if (!Object.values(clean).some((m) => m !== "not_mine")) {
      return fail("Mark at least one part as owned or contributed.");
    }
    // New marks make the old profile out of date.
    return save(story, { ...previous, marks: clean, profile: undefined });
  });
}

// Step three: the one-page role profile.
export async function createRoleProfile(storyId: string): Promise<RoleResult> {
  return withIntroStory(storyId, async (story) => {
    const map = story.content.roleMap;
    const stage = roleMapStage(map);
    if (!map || (stage !== "profile" && stage !== "done")) {
      return fail("Mark each part of your role first.");
    }
    const profile = await writeRoleProfile(map, roleLabel(map));
    return save(story, { ...map, profile });
  });
}

// Seeds the About me answers the profile covers, where the user hasn't answered yet, then goes
// back to the builder.
export async function applyRoleProfile(storyId: string): Promise<RoleResult> {
  const result = await withIntroStory(storyId, async (story) => {
    const map = story.content.roleMap;
    const profile = map?.profile;
    if (!map || !profile) return fail("Write your role profile first.");

    const answers = { ...story.content.answers };
    const seeded = new Set(map.seeded ?? []);
    const storyType = getStoryType(story.storyType);
    if (builderStage(story.content, storyType) === "core") {
      const seeds: Record<string, string> = {
        now: profile.scope,
        known_for: profile.strengths.join("\n"),
        next: profile.fit,
      };
      for (const [id, text] of Object.entries(seeds)) {
        if (text.trim() && !answers[id]?.trim()) {
          answers[id] = text.slice(0, MAX_ANSWER_LENGTH);
          seeded.add(id);
        }
      }
    }
    const roleMap = { ...map, seeded: [...seeded] };
    await updateStory(story.id, { content: { ...story.content, answers, roleMap } });
    return { ok: true, roleMap };
  });
  if (result.ok) redirect(`/stories/${storyId}`);
  return result;
}

async function save(story: StoryRecord, roleMap: RoleMap): Promise<RoleResult> {
  await updateStory(story.id, { content: { ...story.content, roleMap } });
  return { ok: true, roleMap };
}

async function withIntroStory(
  storyId: string,
  run: (story: StoryRecord) => Promise<RoleResult>,
): Promise<RoleResult> {
  try {
    const story = await getStory(String(storyId));
    if (!story) return fail("We couldn't find that story.");
    if (getStoryType(story.storyType)?.format !== "intro") {
      return fail("Map my role is part of Tell me about yourself.");
    }
    return await run(story);
  } catch (err) {
    // redirect() (signed out) throws a control-flow error that must propagate.
    unstable_rethrow(err);
    console.error("Map my role action failed", err);
    if (err instanceof ModelError) {
      return fail("The writing assistant didn't respond. Try again in a moment.");
    }
    return fail(err instanceof Error ? err.message : "Something went wrong. Try again.");
  }
}

function fail(error: string): RoleResult {
  return { ok: false, error };
}

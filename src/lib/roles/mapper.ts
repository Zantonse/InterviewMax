import "server-only";
import { generateForStep, type Step } from "@/lib/ai";
import type { ChatMessage } from "@/lib/ai/types";
import { untracedNumbers } from "@/lib/stories/numbers";
import type { RoleFunction } from "./families";
import {
  FUNCTION_MAP_SYSTEM,
  ROLE_PROFILE_SYSTEM,
  functionMapMessages,
  parseFunctionMap,
  parseProfile,
  profileMessages,
} from "./prompts";
import { type RoleMap, type RoleProfile, roleAnswerText } from "./role-map";

// For a role with no hand-written map: the usual parts of that function, from their title and answers.
export async function buildFunctionMap(
  answers: Record<string, string>,
): Promise<{ name: string; functions: RoleFunction[] }> {
  const { text } = await call("roleMap", FUNCTION_MAP_SYSTEM, functionMapMessages(answers));
  return parseFunctionMap(text);
}

// The one-page role profile. Any line with a number that isn't in their answers is dropped.
export async function writeRoleProfile(map: RoleMap, roleName: string): Promise<RoleProfile> {
  const { text, model } = await call(
    "roleProfile",
    ROLE_PROFILE_SYSTEM,
    profileMessages(map, roleName),
  );
  const profile = parseProfile(text);
  const answers = roleAnswerText(map);
  const traced = (line: string) => untracedNumbers(line, answers).length === 0;
  return {
    scope: traced(profile.scope) ? profile.scope : "",
    strengths: profile.strengths.filter(traced),
    fit: traced(profile.fit) ? profile.fit : "",
    storyIdeas: profile.storyIdeas.filter((s) => traced(s.why)),
    model,
    writtenAt: new Date().toISOString(),
  };
}

async function call(step: Step, system: string, messages: ChatMessage[]) {
  const result = await generateForStep(step, { system, messages });
  if (result.stopReason === "refusal") {
    throw new Error("The model declined to answer. Try rewording your answers.");
  }
  if (result.stopReason === "max_tokens" && !result.text.includes("}")) {
    throw new Error("The model ran out of room before finishing. Try again.");
  }
  return { text: result.text, model: result.model };
}

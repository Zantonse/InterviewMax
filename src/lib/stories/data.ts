import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { getAppMode } from "@/lib/promotion/data";
import { createClient } from "@/lib/supabase/server";
import { isUntouched, parseContent, type StoryContent } from "./content";
import { getStoryType } from "./story-types";

// The one place app code reads and writes stories. Row-level security limits every query to the
// signed-in user's own rows; each function also checks there is a signed-in user.

export type StoryRecord = {
  id: string;
  title: string;
  storyType: string | null;
  content: StoryContent;
  updatedAt: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  id: string;
  title: string;
  story_type: string | null;
  content: unknown;
  updated_at: string;
};

const COLUMNS = "id, title, story_type, content, updated_at";

function toRecord(row: Row): StoryRecord {
  return {
    id: row.id,
    title: row.title,
    storyType: row.story_type,
    content: parseContent(row.content),
    updatedAt: row.updated_at,
  };
}

export async function listStories(): Promise<StoryRecord[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stories")
    .select(COLUMNS)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Couldn't load your stories: ${error.message}`);
  // A behavioral story left empty when it was opened isn't one yet, so it's left out of the bank,
  // the sidebar and coverage. ("Tell me about yourself" is kept: there's one, and it's reused.)
  return (data as Row[]).map(toRecord).filter((s) => !isAbandoned(s));
}

function isAbandoned(story: StoryRecord): boolean {
  return getStoryType(story.storyType)?.format === "star" && isUntouched(story.content);
}

export async function getStory(id: string): Promise<StoryRecord | null> {
  if (!UUID_RE.test(id)) return null;
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("stories").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Couldn't load the story: ${error.message}`);
  return data ? toRecord(data as Row) : null;
}

export async function insertStory(input: {
  title: string;
  storyType: string;
  themes: readonly string[];
  content: StoryContent;
}): Promise<string> {
  await getCurrentUser();
  const supabase = await createClient();
  // A story started in PromotionMax is kept from the coach view unless the user shares it.
  const promotion = (await getAppMode()) === "promotion";
  const { data, error } = await supabase
    .from("stories")
    .insert({
      title: input.title,
      story_type: input.storyType,
      themes: [...input.themes],
      content: input.content,
      ...(promotion ? { mode: "promotion" } : {}),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Couldn't start the story: ${error?.message ?? "no row"}`);
  return data.id as string;
}

export async function updateStory(
  id: string,
  patch: { content: StoryContent; title?: string },
): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("Story not found.");
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stories")
    .update({ content: patch.content, ...(patch.title ? { title: patch.title } : {}) })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`Couldn't save the story: ${error.message}`);
  if (!data?.length) throw new Error("Story not found.");
}

export async function deleteStory(id: string): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("Story not found.");
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("stories").delete().eq("id", id).select("id");
  if (error) throw new Error(`Couldn't delete the story: ${error.message}`);
  if (!data?.length) throw new Error("Story not found.");
}

// PromotionMax stories only: whether the coach can read it. Null for every other story, or when
// the columns aren't there yet.
export async function getCoachSharing(id: string): Promise<{ shared: boolean } | null> {
  if (!UUID_RE.test(id)) return null;
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stories")
    .select("mode, shared_with_coach")
    .eq("id", id)
    .maybeSingle();
  if (error || data?.mode !== "promotion") return null;
  return { shared: data.shared_with_coach === true };
}

export async function setCoachSharing(id: string, shared: boolean): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("Story not found.");
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stories")
    .update({ shared_with_coach: shared })
    .eq("id", id)
    .eq("mode", "promotion")
    .select("id");
  if (error) throw new Error(`Couldn't change who sees the story: ${error.message}`);
  if (!data?.length) throw new Error("Story not found.");
}

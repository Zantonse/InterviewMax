import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseContent, type StoryContent } from "./content";

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
  return (data as Row[]).map(toRecord);
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
  const { data, error } = await supabase
    .from("stories")
    .insert({
      title: input.title,
      story_type: input.storyType,
      themes: [...input.themes],
      content: input.content,
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

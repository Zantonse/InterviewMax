import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseFinder, type StoryFinder } from "./content";

// The one place app code reads and writes the story finder, kept on the user's profile row.
// Row-level security limits every query to the signed-in user's own rows.

export async function getStoryFinder(): Promise<StoryFinder | null> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("story_finder").maybeSingle();
  if (error) throw new Error(`Couldn't load your story ideas: ${error.message}`);
  return parseFinder(data?.story_finder);
}

export async function saveStoryFinder(finder: StoryFinder): Promise<void> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, email: user.email, story_finder: finder });
  if (error) throw new Error(`Couldn't save your story ideas: ${error.message}`);
}

-- Story finder (PRD v0.3): suggested story moments read from the user's resume, LinkedIn profile and
-- role map, and their answers to three quick questions when there's no resume (see
-- src/lib/finder/content.ts). Kept on the profile row, which row-level security already limits to
-- its owner. Safe to run more than once.
alter table public.profiles add column if not exists story_finder jsonb;

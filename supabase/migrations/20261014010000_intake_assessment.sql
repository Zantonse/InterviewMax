-- Intake assessment (PRD v0.3): the user's answers to the first-run quiz, or when they skipped it
-- (see src/lib/assessment/journey.ts). Kept on the profile row, which row-level security already
-- limits to its owner. Safe to run more than once.
alter table public.profiles add column if not exists intake_assessment jsonb;

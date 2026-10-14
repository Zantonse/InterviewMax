-- Numbers checklist (roadmap item 7): for the user's role, the numbers a strong story needs and
-- the values they filled in (see src/lib/numbers/checklist.ts). Kept on the profile row, which
-- row-level security already limits to its owner. Safe to run more than once.
alter table public.profiles add column if not exists numbers_checklist jsonb;

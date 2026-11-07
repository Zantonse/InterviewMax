-- "Exec mode" (Nov 7): an opt-in setting that shows the Exec version card on written stories (see
-- src/lib/exec). Off by default: most people don't need it. Kept on the user's profile row, which
-- row-level security already limits to its owner. Safe to run more than once.

alter table public.profiles add column if not exists exec_mode boolean not null default false;

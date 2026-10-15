-- Practice mode (PRD v0.3, P0): a practice round of a target job's likely questions, answered out
-- loud, with the interviewer's follow-ups and feedback per answer (see src/lib/practice/content.ts).
-- Holds what the user said, so it is private to the owner like every other table, and deleting the
-- profile deletes it. Policies ask public.current_user_id(), so they work for Supabase and Auth0
-- sign-in alike. Safe to run more than once.
create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default public.current_user_id()
    references public.profiles (id) on delete cascade,
  target_job_id uuid not null references public.target_jobs (id) on delete cascade,
  -- The questions in the order asked, each with the user's answers, the follow-ups and the feedback.
  items jsonb not null default '[]'::jsonb,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists practice_sessions_user_id_idx on public.practice_sessions (user_id);
create index if not exists practice_sessions_target_job_id_idx
  on public.practice_sessions (target_job_id, created_at desc);

drop trigger if exists practice_sessions_set_updated_at on public.practice_sessions;
create trigger practice_sessions_set_updated_at before update on public.practice_sessions
  for each row execute function public.set_updated_at();

alter table public.practice_sessions enable row level security;

drop policy if exists "Practice: owner can read" on public.practice_sessions;
create policy "Practice: owner can read" on public.practice_sessions
  for select to authenticated using ((select public.current_user_id()) = user_id);

drop policy if exists "Practice: owner can insert" on public.practice_sessions;
create policy "Practice: owner can insert" on public.practice_sessions
  for insert to authenticated with check (
    (select public.current_user_id()) = user_id
    and exists (
      select 1 from public.target_jobs j
      where j.id = target_job_id and j.user_id = (select public.current_user_id())
    )
  );

drop policy if exists "Practice: owner can update" on public.practice_sessions;
create policy "Practice: owner can update" on public.practice_sessions
  for update to authenticated
  using ((select public.current_user_id()) = user_id)
  with check (
    (select public.current_user_id()) = user_id
    and exists (
      select 1 from public.target_jobs j
      where j.id = target_job_id and j.user_id = (select public.current_user_id())
    )
  );

drop policy if exists "Practice: owner can delete" on public.practice_sessions;
create policy "Practice: owner can delete" on public.practice_sessions
  for delete to authenticated using ((select public.current_user_id()) = user_id);

-- Target jobs (roadmap item 5): the user's resume, and what their target jobs share and where
-- each differs. Safe to run more than once.

-- The resume the user uploaded or pasted ({ fileName, text, updatedAt }), and the read of their
-- target jobs against it (see src/lib/jobs/content.ts).
alter table public.profiles add column if not exists resume jsonb;
alter table public.profiles add column if not exists jobs_overview jsonb;

-- The role level is suggested from the title and confirmed by the user.
alter table public.target_jobs add column if not exists level_confirmed boolean not null default false;
alter table public.target_jobs drop constraint if exists target_jobs_level_check;
alter table public.target_jobs add constraint target_jobs_level_check
  check (level is null or level in ('mid', 'senior', 'principal'));

-- Users who signed up before the tables existed have no profile row; give them one.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- Lets the app create a missing profile row for the signed-in user.
drop policy if exists "Profiles: owner can insert" on public.profiles;
create policy "Profiles: owner can insert" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

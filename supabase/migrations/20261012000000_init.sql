-- InterviewMax foundation schema: profiles, target jobs, stories.
-- Every table is private to its owner via row-level security.

-- Keeps updated_at current on every update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- One row per signed-up user, created automatically from auth.users.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  current_role_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A job the user is interviewing for.
create table public.target_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company text,
  title text not null,
  level text,
  job_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index target_jobs_user_id_idx on public.target_jobs (user_id);

-- A behavioral story in the user's bank.
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_job_id uuid references public.target_jobs (id) on delete set null,
  title text not null default 'Untitled story',
  story_type text,
  themes text[] not null default '{}',
  -- Story parts (context, actions, result, reflection…) and the user's raw answers.
  content jsonb not null default '{}'::jsonb,
  tier text check (tier in ('not_yet', 'good_enough', 'strong')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stories_user_id_idx on public.stories (user_id);
create index stories_target_job_id_idx on public.stories (target_job_id);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger target_jobs_set_updated_at before update on public.target_jobs
  for each row execute function public.set_updated_at();
create trigger stories_set_updated_at before update on public.stories
  for each row execute function public.set_updated_at();

-- Create a profile when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row-level security: users only ever see and change their own rows.
alter table public.profiles enable row level security;
alter table public.target_jobs enable row level security;
alter table public.stories enable row level security;

create policy "Profiles: owner can read" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Profiles: owner can update" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Target jobs: owner can read" on public.target_jobs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Target jobs: owner can insert" on public.target_jobs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Target jobs: owner can update" on public.target_jobs
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Target jobs: owner can delete" on public.target_jobs
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Stories: owner can read" on public.stories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Stories: owner can insert" on public.stories
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (
      target_job_id is null
      or exists (
        select 1 from public.target_jobs j
        where j.id = target_job_id and j.user_id = (select auth.uid())
      )
    )
  );
create policy "Stories: owner can update" on public.stories
  for update to authenticated using ((select auth.uid()) = user_id) with check (
    (select auth.uid()) = user_id
    and (
      target_job_id is null
      or exists (
        select 1 from public.target_jobs j
        where j.id = target_job_id and j.user_id = (select auth.uid())
      )
    )
  );
create policy "Stories: owner can delete" on public.stories
  for delete to authenticated using ((select auth.uid()) = user_id);

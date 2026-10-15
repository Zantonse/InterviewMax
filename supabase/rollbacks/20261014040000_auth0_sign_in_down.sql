-- Undoes supabase/migrations/20261014020000_auth0_sign_in.sql: back to Supabase Auth only, with
-- auth.uid() policies and foreign keys to auth.users. Run in the SQL editor if Auth0 sign-in has to
-- be rolled back. Set AUTH_PROVIDER back to supabase (or remove it) first.
--
-- Profiles created by Auth0 sign-ins have no Supabase Auth user, so the old foreign key can't hold
-- them. This stops with an error rather than deleting them; decide what to do with them first.
begin;

do $$
begin
  if exists (
    select 1 from public.profiles p where not exists (select 1 from auth.users u where u.id = p.id)
  ) then
    raise exception 'Some profiles were created by Auth0 sign-in and have no Supabase Auth user. Rollback stopped; nothing changed.';
  end if;
end;
$$;

-- Policies back to auth.uid().
drop policy if exists "Profiles: owner can read" on public.profiles;
create policy "Profiles: owner can read" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Profiles: owner can insert" on public.profiles;
create policy "Profiles: owner can insert" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "Profiles: owner can update" on public.profiles;
create policy "Profiles: owner can update" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Target jobs: owner can read" on public.target_jobs;
create policy "Target jobs: owner can read" on public.target_jobs
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Target jobs: owner can insert" on public.target_jobs;
create policy "Target jobs: owner can insert" on public.target_jobs
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Target jobs: owner can update" on public.target_jobs;
create policy "Target jobs: owner can update" on public.target_jobs
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Target jobs: owner can delete" on public.target_jobs;
create policy "Target jobs: owner can delete" on public.target_jobs
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Stories: owner can read" on public.stories;
create policy "Stories: owner can read" on public.stories
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Stories: owner can insert" on public.stories;
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
drop policy if exists "Stories: owner can update" on public.stories;
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
drop policy if exists "Stories: owner can delete" on public.stories;
create policy "Stories: owner can delete" on public.stories
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Transcripts: owner can read" on public.interview_transcripts;
create policy "Transcripts: owner can read" on public.interview_transcripts
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Transcripts: owner can insert" on public.interview_transcripts;
create policy "Transcripts: owner can insert" on public.interview_transcripts
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
drop policy if exists "Transcripts: owner can update" on public.interview_transcripts;
create policy "Transcripts: owner can update" on public.interview_transcripts
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
drop policy if exists "Transcripts: owner can delete" on public.interview_transcripts;
create policy "Transcripts: owner can delete" on public.interview_transcripts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Foreign keys and defaults back to auth.users / auth.uid().
drop trigger if exists on_auth_user_deleted on auth.users;
drop function if exists public.handle_deleted_user();

alter table public.target_jobs drop constraint if exists target_jobs_user_id_fkey;
alter table public.target_jobs add constraint target_jobs_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;
alter table public.target_jobs alter column user_id set default auth.uid();

alter table public.stories drop constraint if exists stories_user_id_fkey;
alter table public.stories add constraint stories_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;
alter table public.stories alter column user_id set default auth.uid();

alter table public.interview_transcripts drop constraint if exists interview_transcripts_user_id_fkey;
alter table public.interview_transcripts add constraint interview_transcripts_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;
alter table public.interview_transcripts alter column user_id set default auth.uid();

alter table public.profiles alter column id drop default;
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles add constraint profiles_id_fkey
  foreign key (id) references auth.users (id) on delete cascade;

drop function if exists public.claim_profile();
drop function if exists public.current_user_id();
drop table if exists public.auth_identities;

commit;

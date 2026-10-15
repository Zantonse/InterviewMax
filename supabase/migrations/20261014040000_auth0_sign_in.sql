-- Sign-in with Auth0 (PRD v0.3). Supabase keeps the data and accepts Auth0 ID tokens through
-- third-party auth, so row-level security still limits each user to their own rows.
--
-- Every row stays keyed by the profile's uuid. Auth0 sign-ins map to a profile through
-- public.auth_identities (Auth0 "sub" -> profile id), and policies ask public.current_user_id()
-- instead of auth.uid(). auth.uid() casts the token's sub to uuid, so it errors on an Auth0 sub
-- like "google-oauth2|123"; current_user_id() only calls it for Supabase's own tokens. That keeps
-- Supabase magic-link sign-in working too, until the app's AUTH_PROVIDER switch moves to auth0.
--
-- Existing users are matched by verified email on their first Auth0 sign-in (claim_profile()).
-- Undo with supabase/rollbacks/20261014040000_auth0_sign_in_down.sql.

-- Which Auth0 identities belong to which profile. One person can have several (Google one day,
-- an email code the next) as long as each comes with the same verified email.
create table if not exists public.auth_identities (
  sub text primary key,
  profile_id uuid not null,
  email text,
  created_at timestamptz not null default now()
);
create index if not exists auth_identities_profile_id_idx on public.auth_identities (profile_id);
-- Only the security definer functions below read or write it.
alter table public.auth_identities enable row level security;

-- The signed-in user's profile id, for Supabase and Auth0 tokens alike. Null when signed out or
-- when an Auth0 identity hasn't been claimed yet.
create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when coalesce(auth.jwt() ->> 'iss', '') like '%/auth/v1' then auth.uid()
    else (select i.profile_id from public.auth_identities i where i.sub = auth.jwt() ->> 'sub')
  end
$$;

-- Called by the app after an Auth0 sign-in. Returns the profile id for this Auth0 identity:
-- the one it already has, else the existing profile with the same verified email (a tester who
-- signed up with a magic link keeps their stories), else a new profile.
create or replace function public.claim_profile()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub text := auth.jwt() ->> 'sub';
  v_email text := lower(nullif(trim(auth.jwt() ->> 'email'), ''));
  v_verified boolean := coalesce((auth.jwt() ->> 'email_verified')::boolean, false);
  v_id uuid;
begin
  if coalesce(auth.jwt() ->> 'iss', '') like '%/auth/v1' then
    return auth.uid();
  end if;
  if v_sub is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select i.profile_id into v_id from public.auth_identities i where i.sub = v_sub;
  if found then
    return v_id;
  end if;

  -- Matching by email is only safe when Auth0 says the person proved they own it.
  if v_email is null or not v_verified then
    raise exception 'A verified email is needed to sign in' using errcode = '28000';
  end if;

  -- Two first sign-ins with the same email at once must not make two profiles.
  perform pg_advisory_xact_lock(hashtext('claim_profile:' || v_email));

  select p.id into v_id from public.profiles p
  where lower(p.email) = v_email
  order by p.created_at
  limit 1;
  if v_id is null then
    insert into public.profiles (id, email) values (gen_random_uuid(), v_email) returning id into v_id;
  end if;

  insert into public.auth_identities (sub, profile_id, email) values (v_sub, v_id, v_email)
  on conflict (sub) do nothing;
  select i.profile_id into v_id from public.auth_identities i where i.sub = v_sub;
  return v_id;
end;
$$;

revoke all on function public.current_user_id() from public, anon;
revoke all on function public.claim_profile() from public, anon;
grant execute on function public.current_user_id() to authenticated;
grant execute on function public.claim_profile() to authenticated;

-- Profiles no longer need a Supabase Auth user: Auth0 users have none. Data now hangs off the
-- profile, so deleting a profile still deletes everything the user made.
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles alter column id set default gen_random_uuid();

alter table public.auth_identities drop constraint if exists auth_identities_profile_id_fkey;
alter table public.auth_identities add constraint auth_identities_profile_id_fkey
  foreign key (profile_id) references public.profiles (id) on delete cascade;

alter table public.target_jobs drop constraint if exists target_jobs_user_id_fkey;
alter table public.target_jobs add constraint target_jobs_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.target_jobs alter column user_id set default public.current_user_id();

alter table public.stories drop constraint if exists stories_user_id_fkey;
alter table public.stories add constraint stories_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.stories alter column user_id set default public.current_user_id();

alter table public.interview_transcripts drop constraint if exists interview_transcripts_user_id_fkey;
alter table public.interview_transcripts add constraint interview_transcripts_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.interview_transcripts alter column user_id set default public.current_user_id();

-- Deleting a Supabase Auth user still deletes their profile and data, as the old foreign key did.
create or replace function public.handle_deleted_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.profiles where id = old.id;
  return old;
end;
$$;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function public.handle_deleted_user();

-- Row-level security: same rules as before, asked of current_user_id().
drop policy if exists "Profiles: owner can read" on public.profiles;
create policy "Profiles: owner can read" on public.profiles
  for select to authenticated using ((select public.current_user_id()) = id);
drop policy if exists "Profiles: owner can insert" on public.profiles;
create policy "Profiles: owner can insert" on public.profiles
  for insert to authenticated with check ((select public.current_user_id()) = id);
drop policy if exists "Profiles: owner can update" on public.profiles;
create policy "Profiles: owner can update" on public.profiles
  for update to authenticated
  using ((select public.current_user_id()) = id)
  with check ((select public.current_user_id()) = id);

drop policy if exists "Target jobs: owner can read" on public.target_jobs;
create policy "Target jobs: owner can read" on public.target_jobs
  for select to authenticated using ((select public.current_user_id()) = user_id);
drop policy if exists "Target jobs: owner can insert" on public.target_jobs;
create policy "Target jobs: owner can insert" on public.target_jobs
  for insert to authenticated with check ((select public.current_user_id()) = user_id);
drop policy if exists "Target jobs: owner can update" on public.target_jobs;
create policy "Target jobs: owner can update" on public.target_jobs
  for update to authenticated
  using ((select public.current_user_id()) = user_id)
  with check ((select public.current_user_id()) = user_id);
drop policy if exists "Target jobs: owner can delete" on public.target_jobs;
create policy "Target jobs: owner can delete" on public.target_jobs
  for delete to authenticated using ((select public.current_user_id()) = user_id);

drop policy if exists "Stories: owner can read" on public.stories;
create policy "Stories: owner can read" on public.stories
  for select to authenticated using ((select public.current_user_id()) = user_id);
drop policy if exists "Stories: owner can insert" on public.stories;
create policy "Stories: owner can insert" on public.stories
  for insert to authenticated with check (
    (select public.current_user_id()) = user_id
    and (
      target_job_id is null
      or exists (
        select 1 from public.target_jobs j
        where j.id = target_job_id and j.user_id = (select public.current_user_id())
      )
    )
  );
drop policy if exists "Stories: owner can update" on public.stories;
create policy "Stories: owner can update" on public.stories
  for update to authenticated using ((select public.current_user_id()) = user_id) with check (
    (select public.current_user_id()) = user_id
    and (
      target_job_id is null
      or exists (
        select 1 from public.target_jobs j
        where j.id = target_job_id and j.user_id = (select public.current_user_id())
      )
    )
  );
drop policy if exists "Stories: owner can delete" on public.stories;
create policy "Stories: owner can delete" on public.stories
  for delete to authenticated using ((select public.current_user_id()) = user_id);

drop policy if exists "Transcripts: owner can read" on public.interview_transcripts;
create policy "Transcripts: owner can read" on public.interview_transcripts
  for select to authenticated using ((select public.current_user_id()) = user_id);
drop policy if exists "Transcripts: owner can insert" on public.interview_transcripts;
create policy "Transcripts: owner can insert" on public.interview_transcripts
  for insert to authenticated with check (
    (select public.current_user_id()) = user_id
    and (
      target_job_id is null
      or exists (
        select 1 from public.target_jobs j
        where j.id = target_job_id and j.user_id = (select public.current_user_id())
      )
    )
  );
drop policy if exists "Transcripts: owner can update" on public.interview_transcripts;
create policy "Transcripts: owner can update" on public.interview_transcripts
  for update to authenticated using ((select public.current_user_id()) = user_id) with check (
    (select public.current_user_id()) = user_id
    and (
      target_job_id is null
      or exists (
        select 1 from public.target_jobs j
        where j.id = target_job_id and j.user_id = (select public.current_user_id())
      )
    )
  );
drop policy if exists "Transcripts: owner can delete" on public.interview_transcripts;
create policy "Transcripts: owner can delete" on public.interview_transcripts
  for delete to authenticated using ((select public.current_user_id()) = user_id);

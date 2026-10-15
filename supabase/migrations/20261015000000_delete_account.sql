-- Delete account and data (PRD v0.3, "Data privacy and AI usage"). Two functions the signed-in
-- user calls through the app; each acts only on the caller's own profile.
--
-- public.my_sign_in_ids(): the caller's Auth0 identities, so the app can delete them in Auth0
-- before the rows that map them here are gone. Empty for magic-link users.
--
-- public.delete_my_account(): deletes every row tied to the caller. It sweeps every table in
-- public with a user_id column (stories, target jobs, transcripts, usage events, and any table
-- added later with the same column), then the profile (its foreign keys take Auth0 identity
-- links and anything else hanging off it), then the Supabase sign-in account, if any.
-- Kept on purpose: public.admin_views, the log of admin page views, which holds no content.
--
-- Works before and after the Auth0 migration (20261014040000): it asks current_user_id() when
-- that function exists and auth.uid() otherwise. Safe to run more than once.

create or replace function public.my_profile_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if to_regprocedure('public.current_user_id()') is not null then
    execute 'select public.current_user_id()' into v_id;
  else
    v_id := auth.uid();
  end if;
  return v_id;
end;
$$;

create or replace function public.my_sign_in_ids()
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid := public.my_profile_id();
  v_subs text[];
begin
  if v_id is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if to_regclass('public.auth_identities') is null then
    return '{}';
  end if;
  execute 'select coalesce(array_agg(sub order by sub), ''{}'') from public.auth_identities where profile_id = $1'
    into v_subs using v_id;
  return v_subs;
end;
$$;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := public.my_profile_id();
  v_table text;
begin
  if v_id is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  for v_table in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'user_id'
      and t.table_type = 'BASE TABLE'
    order by c.table_name
  loop
    execute format('delete from public.%I where user_id = $1', v_table) using v_id;
  end loop;

  delete from public.profiles where id = v_id;

  -- The magic-link account, if this person has one (Auth0 users keep their old one's id too).
  delete from auth.users where id = v_id;
end;
$$;

revoke all on function public.my_profile_id() from public, anon, authenticated;
revoke all on function public.my_sign_in_ids() from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.my_sign_in_ids() to authenticated;
grant execute on function public.delete_my_account() to authenticated;

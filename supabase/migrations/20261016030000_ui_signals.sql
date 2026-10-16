-- Signs of confusion while someone uses the app: pages they open, where they leave, rage clicks,
-- clicks on things that don't respond, errors shown and forms started but not sent. Each row is a
-- kind, a path and a short label for the element (its tag and test id, field name or link path),
-- never text the user typed or story content. Only the server writes them (the /api/signals
-- route, with the secret key) and only the admin panel reads them, so there are no row-level
-- security policies. Deleting an account removes them (it sweeps every table with a user_id).
-- Safe to run more than once.

create table if not exists public.ui_signals (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Keep in step with SIGNAL_KINDS in src/lib/signals/kinds.ts.
  kind text not null check (kind in (
    'page_view', 'left', 'rage_click', 'dead_click', 'disabled_click', 'error_shown',
    'js_error', 'form_abandoned'
  )),
  path text not null check (char_length(path) <= 200),
  target text not null default '' check (char_length(target) <= 160),
  created_at timestamptz not null default now()
);
create index if not exists ui_signals_user_id_created_at_idx
  on public.ui_signals (user_id, created_at desc);
alter table public.ui_signals enable row level security;
revoke all on table public.ui_signals from anon, authenticated;

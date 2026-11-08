-- Simulated users (Nov 7): AI personas that build stories on Vercel previews to test the story
-- builder (scripts/sims/README.md). Previews share this database, so persona profiles carry
-- is_simulated and the admin panel leaves them out of every count, funnel and list
-- (src/lib/admin/data.ts). Only the preview-only persona sign-in sets it, with the secret key.
-- Safe to run more than once.

alter table public.profiles add column if not exists is_simulated boolean not null default false;

create index if not exists profiles_is_simulated_idx on public.profiles (id) where is_simulated;

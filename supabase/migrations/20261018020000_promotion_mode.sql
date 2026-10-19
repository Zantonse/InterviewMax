-- PromotionMax (PRD v0.4, beta): a mode of InterviewMax for building the case for the next level
-- where the user already works. Safe to run more than once.
--
-- 1. profiles.app_mode: 'promotion' when the user has switched to PromotionMax; empty means
--    InterviewMax. While it's in beta the app only honors it for admins.
-- 2. profiles.promotion: the promotion plan (current and target level, a pasted career ladder and
--    its dimensions, names to redact before model calls, the latest packet). See
--    src/lib/promotion/content.ts. On the profile row, so row-level security and account deletion
--    already cover it.
-- 3. stories.mode and stories.shared_with_coach: a story started in promotion mode is about the
--    user's current employer, so the coach view (/admin) doesn't show it unless the user shares it.

alter table public.profiles add column if not exists app_mode text;
alter table public.profiles drop constraint if exists profiles_app_mode_check;
alter table public.profiles add constraint profiles_app_mode_check check (app_mode in ('promotion'));

alter table public.profiles add column if not exists promotion jsonb;

alter table public.stories add column if not exists mode text;
alter table public.stories drop constraint if exists stories_mode_check;
alter table public.stories add constraint stories_mode_check check (mode in ('promotion'));

alter table public.stories add column if not exists shared_with_coach boolean not null default false;

-- "Your field" (Nov 4): the kind of work the user does, picked in Settings and kept on their
-- profile row, which row-level security already limits to its owner. Empty means not chosen yet
-- (the app guesses from target job titles). role_field_name holds the name typed for "other".
-- See src/lib/field/fields.ts. Safe to run more than once.

alter table public.profiles add column if not exists role_field text;
alter table public.profiles add column if not exists role_field_name text;

alter table public.profiles drop constraint if exists profiles_role_field_check;
alter table public.profiles add constraint profiles_role_field_check
  check (role_field in (
    'generic', 'sales_engineering', 'data_governance', 'product_design', 'product_management',
    'software_engineering', 'sales', 'customer_success', 'finance', 'other'
  ));

alter table public.profiles drop constraint if exists profiles_role_field_name_check;
alter table public.profiles add constraint profiles_role_field_name_check
  check (role_field_name is null or char_length(role_field_name) between 1 and 60);

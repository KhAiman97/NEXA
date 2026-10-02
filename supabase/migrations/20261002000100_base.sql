-- 01 · Base: shared helpers + profiles
-- Conventions for every table in this schema:
--   * id uuid pk, user_id uuid default auth.uid() -> auth.users (cascade)
--   * created_at / updated_at timestamptz (updated_at maintained by trigger, see last migration)
--   * RLS enabled + "Users see own data" policy
--   * parents expose unique (user_id, id) so children can use composite FKs
--     (user_id, parent_id) and can never reference another user's rows.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  currency     char(3) not null default 'MYR',
  timezone     text not null default 'Asia/Kuala_Lumpur',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Users see own data" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Auto-create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

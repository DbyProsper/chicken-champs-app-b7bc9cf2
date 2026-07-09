create type if not exists public.app_role as enum ('admin', 'staff', 'user');

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  );
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role in ('admin', 'staff')
  );
$$;

alter table public.user_roles enable row level security;

drop policy if exists "read own roles" on public.user_roles;
drop policy if exists "admin manage roles" on public.user_roles;

create policy "read own roles"
  on public.user_roles
  for select
  to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "admin manage roles"
  on public.user_roles
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_staff(uuid) to authenticated;
grant usage on type public.app_role to authenticated;

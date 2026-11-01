-- Sandouq cloud schema. Run in a new Supabase project's SQL editor.
create extension if not exists pgcrypto;

create table if not exists public.groups (
  id uuid primary key, name text not null check (length(name) between 1 and 120),
  code_prefix text not null, code_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists groups_code_prefix_idx on public.groups(code_prefix);

create table if not exists public.admins (
  id uuid primary key, group_id uuid not null references public.groups(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  pin_hash text not null, active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.admins add column if not exists archived_at timestamptz;
create index if not exists admins_group_idx on public.admins(group_id);

create table if not exists public.admin_pin_attempts (
  admin_id uuid primary key references public.admins(id) on delete cascade,
  failures integer not null default 0,
  blocked_until timestamptz
);

create table if not exists public.device_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  admin_id uuid not null references public.admins(id),
  joined_at timestamptz not null default now()
);
create index if not exists device_memberships_group_idx on public.device_memberships(group_id);

create table if not exists public.group_state (
  group_id uuid primary key references public.groups(id) on delete cascade,
  revision bigint not null default 0,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.groups enable row level security;
alter table public.admins enable row level security;
alter table public.admin_pin_attempts enable row level security;
alter table public.device_memberships enable row level security;
alter table public.group_state enable row level security;

create or replace function public.has_active_group(p_group_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.device_memberships d join public.admins a on a.id = d.admin_id
    where d.user_id = (select auth.uid()) and d.group_id::text = p_group_id and a.active
  );
$$;
revoke all on function public.has_active_group(text) from public, anon;
grant execute on function public.has_active_group(text) to authenticated;

create policy "own device membership" on public.device_memberships for select to authenticated using (user_id = (select auth.uid()));
create policy "own group snapshot" on public.group_state for select to authenticated using (
  public.has_active_group(group_state.group_id::text)
);
-- Tables containing code and PIN hashes are never exposed through the Data API.
revoke all on public.groups, public.admins, public.admin_pin_attempts from anon, authenticated;
revoke insert, update, delete on public.group_state, public.device_memberships from anon, authenticated;
grant select on public.group_state, public.device_memberships to authenticated;

create or replace function public.bootstrap_group(
  p_group_id uuid, p_name text, p_code_prefix text, p_code_hash text,
  p_admin_id uuid, p_admin_name text, p_pin_hash text, p_user_id uuid, p_data jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.groups(id, name, code_prefix, code_hash) values (p_group_id, p_name, p_code_prefix, p_code_hash);
  insert into public.admins(id, group_id, name, pin_hash) values (p_admin_id, p_group_id, p_admin_name, p_pin_hash);
  insert into public.group_state(group_id, revision, data) values (p_group_id, 0, p_data);
  insert into public.device_memberships(user_id, group_id, admin_id) values (p_user_id, p_group_id, p_admin_id)
  on conflict (user_id) do update set group_id = excluded.group_id, admin_id = excluded.admin_id, joined_at = now();
end $$;

create or replace function public.cas_group_state(p_group_id uuid, p_expected_revision bigint, p_data jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.group_state set data = p_data, revision = revision + 1, updated_at = now()
  where group_id = p_group_id and revision = p_expected_revision;
  return found;
end $$;

create or replace function public.add_group_admin(
  p_group_id uuid, p_admin_id uuid, p_name text, p_pin_hash text,
  p_expected_revision bigint, p_data jsonb
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.group_state where group_id = p_group_id and revision = p_expected_revision for update;
  if not found then return false; end if;
  insert into public.admins(id, group_id, name, pin_hash) values (p_admin_id, p_group_id, p_name, p_pin_hash);
  update public.group_state set data = p_data, revision = revision + 1, updated_at = now() where group_id = p_group_id;
  return true;
end $$;

create or replace function public.set_group_admin_status(
  p_group_id uuid, p_admin_id uuid, p_active boolean,
  p_expected_revision bigint, p_data jsonb
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.group_state where group_id = p_group_id and revision = p_expected_revision for update;
  if not found then return false; end if;
  update public.admins set active = p_active where id = p_admin_id and group_id = p_group_id;
  if not found then raise exception 'admin not found'; end if;
  update public.group_state set data = p_data, revision = revision + 1, updated_at = now() where group_id = p_group_id;
  return true;
end $$;

create or replace function public.mutate_group_admin(
  p_group_id uuid, p_admin_id uuid, p_name text, p_pin_hash text,
  p_archived boolean, p_expected_revision bigint, p_data jsonb
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.group_state where group_id = p_group_id and revision = p_expected_revision for update;
  if not found then return false; end if;
  update public.admins set
    name = coalesce(p_name, name), pin_hash = coalesce(p_pin_hash, pin_hash),
    active = case when p_archived is null then active else not p_archived end,
    archived_at = case when p_archived is null then archived_at when p_archived then now() else null end
  where id = p_admin_id and group_id = p_group_id;
  if not found then raise exception 'admin not found'; end if;
  update public.group_state set data = p_data, revision = revision + 1, updated_at = now() where group_id = p_group_id;
  return true;
end $$;

create or replace function public.record_pin_failure(p_admin_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare previous_failures integer; previous_blocked timestamptz; new_failures integer;
begin
  insert into public.admin_pin_attempts(admin_id) values (p_admin_id) on conflict do nothing;
  select failures, blocked_until into previous_failures, previous_blocked
  from public.admin_pin_attempts where admin_id = p_admin_id for update;
  new_failures := case when previous_blocked is not null and previous_blocked <= now() then 1 else previous_failures + 1 end;
  update public.admin_pin_attempts set failures = new_failures,
    blocked_until = case when new_failures >= 5 then now() + interval '15 minutes' else null end
  where admin_id = p_admin_id;
end $$;
create or replace function public.clear_pin_failures(p_admin_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.admin_pin_attempts where admin_id = p_admin_id;
$$;

revoke all on function public.bootstrap_group(uuid,text,text,text,uuid,text,text,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.cas_group_state(uuid,bigint,jsonb) from public, anon, authenticated;
revoke all on function public.add_group_admin(uuid,uuid,text,text,bigint,jsonb) from public, anon, authenticated;
revoke all on function public.set_group_admin_status(uuid,uuid,boolean,bigint,jsonb) from public, anon, authenticated;
revoke all on function public.mutate_group_admin(uuid,uuid,text,text,boolean,bigint,jsonb) from public, anon, authenticated;
revoke all on function public.record_pin_failure(uuid) from public, anon, authenticated;
revoke all on function public.clear_pin_failures(uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_group(uuid,text,text,text,uuid,text,text,uuid,jsonb) to service_role;
grant execute on function public.cas_group_state(uuid,bigint,jsonb) to service_role;
grant execute on function public.add_group_admin(uuid,uuid,text,text,bigint,jsonb) to service_role;
grant execute on function public.set_group_admin_status(uuid,uuid,boolean,bigint,jsonb) to service_role;
grant execute on function public.mutate_group_admin(uuid,uuid,text,text,boolean,bigint,jsonb) to service_role;
grant execute on function public.record_pin_failure(uuid) to service_role;
grant execute on function public.clear_pin_failures(uuid) to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('sandouq-receipts', 'sandouq-receipts', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "group receipt read" on storage.objects for select to authenticated using (
  bucket_id = 'sandouq-receipts' and public.has_active_group(split_part(name, '/', 1))
);
create policy "group receipt upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'sandouq-receipts' and public.has_active_group(split_part(name, '/', 1))
);
create policy "group receipt retry" on storage.objects for update to authenticated using (
  bucket_id = 'sandouq-receipts' and public.has_active_group(split_part(name, '/', 1))
) with check (
  bucket_id = 'sandouq-receipts' and public.has_active_group(split_part(name, '/', 1))
);

do $$ begin
  alter publication supabase_realtime add table public.group_state;
exception when duplicate_object then null; end $$;

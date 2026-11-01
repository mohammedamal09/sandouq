alter table public.admins add column if not exists archived_at timestamptz;

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

revoke all on function public.mutate_group_admin(uuid,uuid,text,text,boolean,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.mutate_group_admin(uuid,uuid,text,text,boolean,bigint,jsonb) to service_role;

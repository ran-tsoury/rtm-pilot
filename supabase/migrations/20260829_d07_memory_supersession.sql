create or replace function public.rtm_supersede_memory(
  p_previous_id uuid,
  p_memory_level text,
  p_memory_type text,
  p_content text,
  p_status text,
  p_confidence text,
  p_source_episode_id uuid default null
)
returns setof public.memory_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_previous public.memory_items%rowtype;
  v_replacement public.memory_items%rowtype;
begin
  v_owner_id := auth.uid();

  if v_owner_id is null then
    raise exception 'Authenticated owner is required';
  end if;

  select *
  into v_previous
  from public.memory_items
  where id = p_previous_id
    and user_id = v_owner_id
  for update;

  if not found then
    raise exception 'Owner-scoped memory was not found';
  end if;

  update public.memory_items
  set
    status = 'SUPERSEDED',
    do_not_reuse = true
  where id = p_previous_id
    and user_id = v_owner_id;

  insert into public.memory_items (
    user_id,
    memory_level,
    memory_type,
    content,
    status,
    confidence,
    source_episode_id,
    supersedes_memory_id,
    do_not_reuse
  )
  values (
    v_owner_id,
    p_memory_level,
    p_memory_type,
    p_content,
    p_status,
    p_confidence,
    p_source_episode_id,
    p_previous_id,
    false
  )
  returning *
  into v_replacement;

  return next v_replacement;
end;
$$;

revoke all
on function public.rtm_supersede_memory(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid
)
from public;

grant execute
on function public.rtm_supersede_memory(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid
)
to authenticated;
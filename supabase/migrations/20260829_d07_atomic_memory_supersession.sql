create or replace function public.rtm_supersede_memory(
  p_previous_id text,
  p_memory_level text,
  p_memory_type text,
  p_content text,
  p_status text,
  p_confidence text,
  p_source_episode_id text default null
)
returns setof public.memory_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_previous public.memory_items%rowtype;
  v_replacement public.memory_items%rowtype;
begin
  if auth.uid() is null then
    raise exception
      'Authenticated participant is required';
  end if;

  select *
  into v_previous
  from public.memory_items
  where id::text = p_previous_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception
      'Owner-scoped previous memory record was not found';
  end if;

  update public.memory_items
  set
    status = 'SUPERSEDED',
    do_not_reuse = true,
    updated_at = now()
  where id = v_previous.id
    and user_id = auth.uid();

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
    auth.uid(),
    p_memory_level,
    p_memory_type,
    p_content,
    p_status,
    p_confidence,
    nullif(
      p_source_episode_id,
      ''
    ),
    v_previous.id,
    false
  )
  returning *
  into v_replacement;

  return next v_replacement;
  return;
end;
$$;

revoke all
on function public.rtm_supersede_memory(
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
from public;

grant execute
on function public.rtm_supersede_memory(
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
to authenticated;
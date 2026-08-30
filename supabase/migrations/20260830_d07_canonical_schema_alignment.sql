alter table public.memory_items
drop constraint if exists memory_items_status_check;

alter table public.memory_items
add constraint memory_items_status_check
check (
  status in (
    'KNOWN',
    'UNKNOWN',
    'STALE',
    'CONTRADICTED',
    'SUPERSEDED'
  )
);

alter table public.memory_items
alter column status set default 'UNKNOWN';

alter table public.memory_items
drop constraint if exists memory_items_memory_level_check;

alter table public.memory_items
add constraint memory_items_memory_level_check
check (
  memory_level in (
    'M1',
    'M2',
    'M3',
    'M4',
    'M5'
  )
);

alter table public.evidence
drop constraint if exists evidence_strength_check;

alter table public.evidence
add constraint evidence_strength_check
check (
  strength in (
    'E0',
    'E1',
    'E2',
    'E3',
    'E4',
    'E5'
  )
);
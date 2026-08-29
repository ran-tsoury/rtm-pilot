alter table public.evidence
  add column if not exists content jsonb;

alter table public.evidence
  add column if not exists outcome text;

alter table public.evidence
  add column if not exists outcome_status text;

alter table public.evidence
  add column if not exists confidence double precision;

alter table public.evidence
  add column if not exists admission_status text;

alter table public.evidence
  add column if not exists admission_reason text;

alter table public.evidence
  add column if not exists source_kind text;

alter table public.evidence
  add column if not exists provenance jsonb;

alter table public.evidence
  add column if not exists observed_at timestamptz;

alter table public.evidence
  add column if not exists schema_version integer;

alter table public.evidence
  drop constraint if exists evidence_confidence_range;

alter table public.evidence
  add constraint evidence_confidence_range
  check (
    confidence is null
    or (
      confidence >= 0
      and confidence <= 1
    )
  );
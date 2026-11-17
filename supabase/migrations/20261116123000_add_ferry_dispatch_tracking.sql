begin;

alter table public.ferry_manifest_entries
  add column if not exists despachado_en timestamptz;

create index if not exists ferry_manifest_entries_dispatched_idx
  on public.ferry_manifest_entries (despachado_en);

comment on column public.ferry_manifest_entries.despachado_en is
  'When warehouse staff scanned this package into a ferry dispatch batch. This is separate from enviado_en, which records a submitted booking number.';

commit;

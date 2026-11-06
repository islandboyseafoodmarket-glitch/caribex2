alter table public.ferry_manifest_entries
  drop constraint if exists ferry_manifest_entries_puerto_check;

alter table public.ferry_manifest_entries
  add constraint ferry_manifest_entries_puerto_check
  check (puerto in ('la_ceiba', 'utila', 'guanaja', 'san_pedro_sula', 'tegucigalpa'));

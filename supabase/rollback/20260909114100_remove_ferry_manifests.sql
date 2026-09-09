begin;

drop trigger if exists ferry_manifest_entries_updated_at
  on public.ferry_manifest_entries;

drop trigger if exists ferry_manifests_updated_at
  on public.ferry_manifests;

drop function if exists public.set_ferry_manifest_updated_at();

drop table if exists public.ferry_manifest_entries;
drop table if exists public.ferry_manifests;

commit;

begin;

drop policy if exists ferry_manifests_admin_select on public.ferry_manifests;
drop policy if exists ferry_manifests_admin_insert on public.ferry_manifests;
drop policy if exists ferry_manifests_admin_update on public.ferry_manifests;
drop policy if exists ferry_manifests_admin_delete on public.ferry_manifests;

drop policy if exists ferry_manifest_entries_admin_select on public.ferry_manifest_entries;
drop policy if exists ferry_manifest_entries_admin_insert on public.ferry_manifest_entries;
drop policy if exists ferry_manifest_entries_admin_update on public.ferry_manifest_entries;
drop policy if exists ferry_manifest_entries_admin_delete on public.ferry_manifest_entries;

commit;

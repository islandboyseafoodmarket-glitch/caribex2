begin;

alter table public.ferry_manifests
  add column if not exists ubicacion varchar(30) not null default 'legacy';

alter table public.ferry_manifests
  drop constraint if exists ferry_manifests_ubicacion_check;

alter table public.ferry_manifests
  add constraint ferry_manifests_ubicacion_check
  check (ubicacion in ('legacy', 'la_ceiba_utila', 'guanaja', 'san_pedro_sula', 'tegucigalpa'));

-- A container can have separate manifests for separate destinations.
alter table public.ferry_manifests
  drop constraint if exists ferry_manifests_contenedor_id_key;

create unique index if not exists ferry_manifests_container_location_key
  on public.ferry_manifests (contenedor_id, ubicacion);

alter table public.ferry_manifest_entries
  drop constraint if exists ferry_manifest_entries_puerto_check;

alter table public.ferry_manifest_entries
  add constraint ferry_manifest_entries_puerto_check
  check (puerto in ('la_ceiba', 'utila', 'guanaja', 'san_pedro_sula', 'tegucigalpa'));

commit;

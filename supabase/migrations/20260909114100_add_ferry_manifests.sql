begin;

-- This migration adds only ferry-manifest tables.
-- It intentionally does not alter any existing Caribex 2 table.
-- The type checks fail before any DDL runs if the existing IDs are not UUIDs.
do $$
declare
  required_table text;
  required_column text;
  actual_type text;
begin
  for required_table, required_column in
    select * from (values
      ('contenedores', 'id'),
      ('paquetes_registro', 'id'),
      ('numero_cliente', 'id')
    ) as required_columns(table_name, column_name)
  loop
    select c.udt_name
      into actual_type
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = required_table
       and c.column_name = required_column;

    if actual_type is null then
      raise exception 'Required column public.%.% was not found', required_table, required_column;
    end if;

    if actual_type <> 'uuid' then
      raise exception 'Expected public.%.% to be uuid, found %', required_table, required_column, actual_type;
    end if;
  end loop;
end $$;

create table if not exists public.ferry_manifests (
  id uuid primary key default gen_random_uuid(),
  contenedor_id uuid not null unique
    references public.contenedores(id)
    on update cascade
    on delete restrict,
  token varchar(128) not null unique,
  semana_inicio timestamptz not null,
  semana_fin timestamptz not null,
  estado varchar(20) not null default 'active'
    check (estado in ('active', 'completed', 'archived')),
  creado_por uuid not null
    references auth.users(id)
    on update cascade
    on delete restrict,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  archivado_en timestamptz,
  constraint ferry_manifests_week_range_check
    check (semana_fin >= semana_inicio)
);

create table if not exists public.ferry_manifest_entries (
  id uuid primary key default gen_random_uuid(),
  manifiesto_id uuid not null
    references public.ferry_manifests(id)
    on update cascade
    on delete cascade,
  paquete_id uuid not null
    references public.paquetes_registro(id)
    on update cascade
    on delete restrict,
  numero_cliente_id uuid not null
    references public.numero_cliente(id)
    on update cascade
    on delete restrict,
  puerto varchar(20) not null
    check (puerto in ('la_ceiba', 'utila')),
  numero_cuenta varchar(50) not null,
  nombre_cliente varchar(255) not null,
  etiqueta_cantidad varchar(100) not null default 'BOX= 1',
  numero_reserva varchar(100),
  nombre_receptor varchar(255),
  enviado_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint ferry_manifest_entries_unique_package
    unique (manifiesto_id, paquete_id)
);

create index if not exists ferry_manifests_estado_idx
  on public.ferry_manifests (estado);

create index if not exists ferry_manifests_semana_inicio_idx
  on public.ferry_manifests (semana_inicio desc);

create index if not exists ferry_manifest_entries_manifiesto_idx
  on public.ferry_manifest_entries (manifiesto_id);

create index if not exists ferry_manifest_entries_paquete_idx
  on public.ferry_manifest_entries (paquete_id);

create index if not exists ferry_manifest_entries_cliente_idx
  on public.ferry_manifest_entries (numero_cliente_id);

create index if not exists ferry_manifest_entries_puerto_idx
  on public.ferry_manifest_entries (manifiesto_id, puerto);

create or replace function public.set_ferry_manifest_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists ferry_manifests_updated_at on public.ferry_manifests;
create trigger ferry_manifests_updated_at
before update on public.ferry_manifests
for each row execute function public.set_ferry_manifest_updated_at();

drop trigger if exists ferry_manifest_entries_updated_at on public.ferry_manifest_entries;
create trigger ferry_manifest_entries_updated_at
before update on public.ferry_manifest_entries
for each row execute function public.set_ferry_manifest_updated_at();

alter table public.ferry_manifests enable row level security;
alter table public.ferry_manifest_entries enable row level security;

commit;

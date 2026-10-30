-- Resolve an identification issue when an unassigned package is assigned to a customer.
-- This is intentionally transition-based: already-assigned packages are not changed on
-- reassignment. Existing issues need separate audit-backed review before correction.

create or replace function public.resolve_identification_issue_status(
  previous_customer_id uuid,
  new_customer_id uuid,
  current_status text
)
returns text
language sql
immutable
as $$
  select case
    when previous_customer_id is null and new_customer_id is not null then 'RESOLVED'
    when previous_customer_id is not null and new_customer_id is null then 'OPEN'
    else current_status
  end;
$$;

create or replace function public.resolve_identification_issue_on_assignment()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  new.issue_status := public.resolve_identification_issue_status(
    old.numero_cliente_id,
    new.numero_cliente_id,
    new.issue_status
  );

  return new;
end;
$$;

drop trigger if exists paquetes_registro_resolve_identification_issue_on_assignment
  on public.paquetes_registro;

create trigger paquetes_registro_resolve_identification_issue_on_assignment
before update of numero_cliente_id
on public.paquetes_registro
for each row
execute function public.resolve_identification_issue_on_assignment();

-- No blanket backfill is performed: being assigned alone does not prove that every
-- historical package problem was resolved. Review recorded assignment/reopen events.

-- Migration self-test guidance (not executed here; run only against a disposable clone).
-- The synthetic table deliberately contains the fields touched by the generic trigger;
-- all assertions are rolled back and no production rows are inserted or updated.
--
-- begin;
-- create temp table synthetic_paquetes_registro (
--   id integer primary key,
--   numero_cliente_id uuid,
--   issue_status text,
--   problema boolean,
--   notas text,
--   notas_imagenes text[]
-- );
-- create trigger synthetic_resolve_identification_issue
-- before update of numero_cliente_id on synthetic_paquetes_registro
-- for each row
-- execute function public.resolve_identification_issue_on_assignment();
-- insert into synthetic_paquetes_registro
--   (id, numero_cliente_id, issue_status, problema, notas, notas_imagenes)
-- values
--   (1, null, 'OPEN', true, 'history', array['photo-url']),
--   (2, '00000000-0000-0000-0000-000000000001', 'OPEN', true, 'reassigned', array['photo-url']),
--   (3, null, 'RESOLVED', true, 'still-unassigned', array['photo-url']),
--   (4, '00000000-0000-0000-0000-000000000002', 'RESOLVED', true, 'customer-removed', array['photo-url']);
-- update synthetic_paquetes_registro
--    set numero_cliente_id = '00000000-0000-0000-0000-000000000003'
--  where id = 1;
-- update synthetic_paquetes_registro
--    set numero_cliente_id = '00000000-0000-0000-0000-000000000004'
--  where id = 2;
-- update synthetic_paquetes_registro
--    set numero_cliente_id = null
--  where id = 4;
-- update synthetic_paquetes_registro
--    set numero_cliente_id = null
--  where id = 3;
-- do $$
-- begin
--   if (select issue_status from synthetic_paquetes_registro where id = 1) is distinct from 'RESOLVED'
--      or (select problema from synthetic_paquetes_registro where id = 1) is distinct from true
--      or (select notas from synthetic_paquetes_registro where id = 1) is distinct from 'history'
--      or (select notas_imagenes from synthetic_paquetes_registro where id = 1) is distinct from array['photo-url']::text[] then
--     raise exception 'unassigned -> assigned must resolve while preserving issue history';
--   end if;
--   if (select issue_status from synthetic_paquetes_registro where id = 2) is distinct from 'OPEN' then
--     raise exception 'already-assigned reassignment must not auto-resolve';
--   end if;
--   if (select issue_status from synthetic_paquetes_registro where id = 3) is distinct from 'RESOLVED' then
--     raise exception 'null-to-null updates must preserve the current status';
--   end if;
--   if (select issue_status from synthetic_paquetes_registro where id = 4) is distinct from 'OPEN' then
--     raise exception 'removing a customer must reopen the issue';
--   end if;
-- end;
-- $$;
-- rollback;

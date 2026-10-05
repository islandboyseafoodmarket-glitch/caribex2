alter table public.paquetes_registro
  add column if not exists issue_status text;

alter table public.paquetes_registro
  drop constraint if exists paquetes_registro_issue_status_check;

alter table public.paquetes_registro
  add constraint paquetes_registro_issue_status_check
  check (issue_status is null or issue_status in ('OPEN', 'RESOLVED'));

comment on column public.paquetes_registro.issue_status is
  'Operational issue lifecycle: OPEN while staff must review it, RESOLVED after pickup/checkout.';

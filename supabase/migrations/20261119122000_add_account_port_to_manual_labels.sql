begin;

alter table public.caribex_manual_labels
  add column if not exists account_number text,
  add column if not exists destination_port text;

alter table public.caribex_manual_labels
  drop constraint if exists caribex_manual_labels_account_port_check;

alter table public.caribex_manual_labels
  add constraint caribex_manual_labels_account_port_check
  check (
    (account_number is null and destination_port is null)
    or (
      account_number ~ '^[0-9]{1,30}$'
      and destination_port in ('la_ceiba', 'utila', 'guanaja', 'san_pedro_sula', 'tegucigalpa')
    )
  );

comment on column public.caribex_manual_labels.account_number is
  'Raw numeric numero_cliente value; the printable port-initial prefix is formatted at display time.';
comment on column public.caribex_manual_labels.destination_port is
  'Canonical FerryPort destination used for printed label coloring and account prefix formatting.';

commit;

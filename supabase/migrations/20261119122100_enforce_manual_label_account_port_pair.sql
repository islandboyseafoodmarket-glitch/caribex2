begin;

alter table public.caribex_manual_labels
  drop constraint if exists caribex_manual_labels_account_port_check;

alter table public.caribex_manual_labels
  add constraint caribex_manual_labels_account_port_check
  check (
    (account_number is null and destination_port is null)
    or (
      account_number is not null
      and destination_port is not null
      and account_number ~ '^[0-9]{1,30}$'
      and destination_port in ('la_ceiba', 'utila', 'guanaja', 'san_pedro_sula', 'tegucigalpa')
    )
  );

commit;

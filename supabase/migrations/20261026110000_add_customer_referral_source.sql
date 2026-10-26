begin;

alter table public.numero_cliente
  add column if not exists heard_about_us text,
  add column if not exists heard_about_us_details text;

commit;

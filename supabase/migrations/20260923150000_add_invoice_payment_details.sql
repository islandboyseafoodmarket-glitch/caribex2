alter table public.paquetes_registro
  add column if not exists payment_method text,
  add column if not exists payment_notes text;

comment on column public.paquetes_registro.payment_method is
  'Payment method recorded by authorized admin: Zelle, PayPal, Cash, or Credit granted';
comment on column public.paquetes_registro.payment_notes is
  'Administrative notes about the invoice payment';

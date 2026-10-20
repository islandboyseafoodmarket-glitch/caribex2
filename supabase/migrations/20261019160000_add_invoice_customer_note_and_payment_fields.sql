alter table public.paquetes_registro
  add column if not exists payment_reference text,
  add column if not exists payment_date date,
  add column if not exists customer_invoice_note text;

comment on column public.paquetes_registro.payment_reference is
  'Bank, wire, Zelle, PayPal, or other payment reference entered by authorized staff.';
comment on column public.paquetes_registro.payment_date is
  'Date the invoice payment was received.';
comment on column public.paquetes_registro.customer_invoice_note is
  'Optional note intentionally approved for display on the customer invoice; never use notas for this.';

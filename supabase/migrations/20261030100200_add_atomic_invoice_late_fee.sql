begin;

alter table public.paquetes_registro
  add column if not exists invoice_sent_at timestamptz;

create or replace function public.apply_invoice_late_fee(p_invoice_id uuid)
returns table (
  invoice_id uuid,
  tracking text,
  late_fee_amount numeric,
  billing_subtotal numeric,
  billing_tax numeric,
  billing_total numeric,
  paid numeric,
  balance numeric,
  invoice_sent_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_invoice public.paquetes_registro%rowtype;
  v_checkin public.paquetes_checkin%rowtype;
  v_paid numeric(14,2);
  v_balance numeric(14,2);
  v_fee numeric(14,2);
  v_line text;
begin
  if p_invoice_id is null then
    raise exception using errcode = '22023', message = 'INVOICE_ID_REQUIRED';
  end if;

  -- The invoice lock serializes late-fee calls with one another and with ledger
  -- payment RPCs, which acquire the same row lock before changing payment state.
  select * into v_invoice
  from public.paquetes_registro
  where id = p_invoice_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'INVOICE_NOT_FOUND';
  end if;

  if v_invoice.billing_total is null or v_invoice.billing_total < 0
     or v_invoice.billing_subtotal is null then
    raise exception using errcode = 'P0001', message = 'INVOICE_TOTAL_REQUIRED';
  end if;
  if v_invoice.invoice_sent_at is null then
    raise exception using errcode = 'P0001', message = 'INVOICE_SENT_TIMESTAMP_REQUIRED';
  end if;
  if v_invoice.invoice_sent_at > now() - interval '30 days' then
    raise exception using errcode = 'P0001', message = 'INVOICE_NOT_30_DAYS_OVERDUE';
  end if;
  if upper(coalesce(v_invoice.invoice_status::text, '')) = 'PAID' then
    raise exception using errcode = 'P0001', message = 'INVOICE_ALREADY_PAID';
  end if;

  select b.paid, b.balance
    into v_paid, v_balance
  from public.invoice_payment_balances b
  where b.invoice_id = p_invoice_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'INVOICE_PAYMENT_BALANCE_MISSING';
  end if;
  if coalesce(v_balance, 0) <= 0 then
    raise exception using errcode = 'P0001', message = 'INVOICE_NO_OUTSTANDING_BALANCE';
  end if;

  select c.* into v_checkin
  from public.paquetes_checkin c
  where c.paquete_id = p_invoice_id
  order by c.creado_en desc nulls last, c.id desc
  limit 1
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'INVOICE_CHECKIN_REQUIRED';
  end if;
  if exists (
    select 1 from public.paquetes_checkin as c
    where c.paquete_id = p_invoice_id
      and coalesce(c.cargos_adicionales, '') ~* 'late\s+fee\s*\(\s*5\s*%\s*\)'
  ) then
    raise exception using errcode = 'P0001', message = 'LATE_FEE_ALREADY_APPLIED';
  end if;

  -- Store money at cent precision and deliberately do not alter billing_tax:
  -- a late-fee line is not subject to the handling/tax percentage again.
  v_fee := round(v_invoice.billing_total * 0.05, 2)::numeric(14,2);
  if v_fee <= 0 then
    raise exception using errcode = 'P0001', message = 'LATE_FEE_AMOUNT_TOO_SMALL';
  end if;
  v_line := 'Late fee (5%) (+$' || to_char(v_fee, 'FM999999999999990.00') || ')';

  update public.paquetes_checkin
  set cargos_adicionales = case
    when nullif(btrim(coalesce(v_checkin.cargos_adicionales, '')), '') is null then v_line
    else btrim(v_checkin.cargos_adicionales) || ', ' || v_line
  end
  where id = v_checkin.id;

  update public.paquetes_registro as p
  set billing_subtotal = p.billing_subtotal + v_fee,
      billing_total = p.billing_total + v_fee
  where p.id = p_invoice_id
  returning p.* into v_invoice;

  -- Re-read the view after the total update so the returned balance reflects
  -- the late fee while paid remains the immutable ledger sum.
  select b.paid, b.balance
    into v_paid, v_balance
  from public.invoice_payment_balances b
  where b.invoice_id = p_invoice_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'INVOICE_PAYMENT_BALANCE_MISSING';
  end if;

  return query select v_invoice.id, v_invoice.tracking::text, v_fee,
    v_invoice.billing_subtotal::numeric, v_invoice.billing_tax::numeric,
    v_invoice.billing_total::numeric, v_paid::numeric, v_balance::numeric,
    v_invoice.invoice_sent_at;
end;
$$;

revoke all on function public.apply_invoice_late_fee(uuid) from public, anon, authenticated, service_role;
grant execute on function public.apply_invoice_late_fee(uuid) to service_role;

commit;

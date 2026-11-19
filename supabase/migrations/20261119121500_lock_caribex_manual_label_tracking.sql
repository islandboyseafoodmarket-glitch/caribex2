begin;

create or replace function public.reject_duplicate_caribex_manual_label()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Share the same transaction-scoped lock used by package registration so a
  -- concurrent label issue cannot race a package write for the same code.
  perform pg_advisory_xact_lock(hashtextextended(upper(btrim(new.tracking)), 0));

  if exists (
    select 1
    from public.paquetes_registro p
    where upper(btrim(p.tracking)) = upper(btrim(new.tracking))
  ) then
    raise exception 'Caribex manual label already exists as a shipment tracking number.'
      using errcode = '23505';
  end if;
  return new;
end;
$$;
revoke all on function public.reject_duplicate_caribex_manual_label() from public, anon, authenticated;

create or replace function public.consume_caribex_manual_label_for_package()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_tracking text;
  consumed_label_id uuid;
  label_status text;
  label_package_id uuid;
begin
  if new.tracking is null or length(btrim(new.tracking)) = 0 then
    return new;
  end if;

  normalized_tracking := upper(btrim(new.tracking));
  if tg_op = 'UPDATE' and normalized_tracking = upper(btrim(coalesce(old.tracking, ''))) then
    return new;
  end if;

  -- Serialize with label issuance and all other package registrations for this code.
  perform pg_advisory_xact_lock(hashtextextended(normalized_tracking, 0));

  update public.caribex_manual_labels
     set status = 'used',
         used_by_package_id = new.id,
         used_at = now()
   where upper(btrim(tracking)) = normalized_tracking
     and status = 'available'
   returning id into consumed_label_id;

  if consumed_label_id is not null then
    return new;
  end if;

  select status, used_by_package_id
    into label_status, label_package_id
    from public.caribex_manual_labels
   where upper(btrim(tracking)) = normalized_tracking;

  if not found then
    return new;
  end if;

  if label_status = 'used' and label_package_id = new.id then
    return new;
  end if;

  raise exception 'Caribex manual label already used / Esta etiqueta manual de Caribex ya fue utilizada.'
    using errcode = '23505';
end;
$$;
revoke all on function public.consume_caribex_manual_label_for_package() from public, anon, authenticated;

commit;

begin;

create table if not exists public.caribex_manual_labels (
  id uuid primary key default gen_random_uuid(),
  tracking text not null check (length(btrim(tracking)) > 0),
  status text not null default 'available' check (status in ('available', 'used')),
  created_by uuid references auth.users(id) on delete set null,
  used_by_package_id uuid references public.paquetes_registro(id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  constraint caribex_manual_labels_used_state_check check (
    (status = 'available' and used_at is null and used_by_package_id is null)
    or status = 'used'
  )
);

create unique index if not exists caribex_manual_labels_tracking_normalized_uidx
  on public.caribex_manual_labels (upper(btrim(tracking)));
create index if not exists caribex_manual_labels_available_created_idx
  on public.caribex_manual_labels (created_at desc)
  where status = 'available';

alter table public.caribex_manual_labels enable row level security;
revoke all on table public.caribex_manual_labels from anon, authenticated;
grant all on table public.caribex_manual_labels to service_role;

create or replace function public.reject_duplicate_caribex_manual_label()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
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

drop trigger if exists caribex_manual_labels_reject_package_duplicate on public.caribex_manual_labels;
create trigger caribex_manual_labels_reject_package_duplicate
before insert on public.caribex_manual_labels
for each row execute function public.reject_duplicate_caribex_manual_label();

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
    -- Ordinary carrier tracking numbers are not part of the manual-label registry.
    return new;
  end if;

  if label_status = 'used' and label_package_id = new.id then
    -- Re-saving the same shipment is not a second use of its label.
    return new;
  end if;

  raise exception 'Caribex manual label already used / Esta etiqueta manual de Caribex ya fue utilizada.'
    using errcode = '23505';
end;
$$;
revoke all on function public.consume_caribex_manual_label_for_package() from public, anon, authenticated;

drop trigger if exists paquetes_registro_consume_caribex_manual_label on public.paquetes_registro;
create trigger paquetes_registro_consume_caribex_manual_label
before insert or update of tracking on public.paquetes_registro
for each row execute function public.consume_caribex_manual_label_for_package();

comment on table public.caribex_manual_labels is
  'Shared registry for manually generated Caribex box labels. Used labels are retained permanently and excluded from available-label lists.';
comment on column public.caribex_manual_labels.used_by_package_id is
  'Package that first consumed the label; deletion of that package does not restore availability.';

commit;

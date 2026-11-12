-- Prevent the same shipment tracking number from being registered twice.
-- This intentionally includes archived shipments so tracking history remains unique.
-- Empty tracking values are excluded because they are not valid shipment identifiers.

create unique index if not exists paquetes_registro_tracking_unique_idx
  on public.paquetes_registro (upper(btrim(tracking)))
  where tracking is not null and btrim(tracking) <> '';

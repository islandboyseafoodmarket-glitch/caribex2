-- Every shipment that has advanced beyond Receiving must have a paquetes_checkin
-- relationship, even when dimensions have not been entered yet.
insert into public.paquetes_checkin (paquete_id, numero_cliente_id)
select p.id, p.numero_cliente_id
from public.paquetes_registro p
where p.estado in (
  'Registrado',
  'Check In',
  'Check-in',
  'En tránsito',
  'En transito',
  'Descargado (Roatan)',
  'Descargado',
  'Entregado',
  'Recogido'
)
and not exists (
  select 1
  from public.paquetes_checkin c
  where c.paquete_id = p.id
)
limit 500;

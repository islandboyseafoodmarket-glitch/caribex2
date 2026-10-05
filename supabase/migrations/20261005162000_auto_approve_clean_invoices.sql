-- Clean invoices should be approved automatically. Shipments with an internal
-- note or at least one uploaded problem photo remain pending for review.
update public.paquetes_registro
set approval_status = case
  when nullif(trim(coalesce(notas, '')), '') is not null
    or cardinality(notas_imagenes) > 0
    then 'PENDING'
  else 'APPROVED'
end
where (estado ilike '%descargado%' or estado ilike '%entregado%')
  and (approval_status is null or approval_status = 'PENDING');

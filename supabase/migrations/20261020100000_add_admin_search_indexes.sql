create index if not exists paquetes_registro_tracking_idx
  on public.paquetes_registro (tracking);
create index if not exists paquetes_registro_customer_status_created_idx
  on public.paquetes_registro (numero_cliente_id, estado, creado_en desc);
create index if not exists paquetes_registro_invoice_status_idx
  on public.paquetes_registro (invoice_status, approval_status, creado_en desc);
create index if not exists paquetes_registro_created_idx
  on public.paquetes_registro (creado_en desc);
create index if not exists contenedor_paquetes_package_container_idx
  on public.contenedor_paquetes (paquete_id, contenedor_id);
create index if not exists contenedor_paquetes_container_package_idx
  on public.contenedor_paquetes (contenedor_id, paquete_id);
create index if not exists numero_cliente_port_name_idx
  on public.numero_cliente (puerto, nombre);
